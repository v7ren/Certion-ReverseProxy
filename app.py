"""
Flask + aiohttp unified HTTP server
Single port handles: Flask app, WebSocket tunnels, and HTTP proxy
"""
import datetime
import os
import logging
from pathlib import Path
from threading import Thread
import asyncio

from flask import Flask, abort, send_file, send_from_directory, jsonify, request
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from flask_cors import CORS
from sqlalchemy import create_engine
from sqlalchemy.orm import scoped_session, sessionmaker

# Import models and auth
from models import Command, db, User, Agent, Project
from auth import auth_bp
from projects import projects_bp

# Proxy / tunnel modules
from aiohttp import web
import tunnels as tunnelv2  # Use the debug version
from subdomainv2 import generate_subdomain, extract_subdomain

# WSGI adapter for Flask in aiohttp
from aiohttp_wsgi import WSGIHandler

# =========================
# Logging
# =========================
logging.basicConfig(
    level=logging.DEBUG,  # Set to DEBUG for more verbose logging
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
log = logging.getLogger(__name__)

# =========================
# Configuration
# =========================
DOMAIN = os.environ.get("DOMAIN", "DOMAIN.COM")
PORT = int(os.environ.get("PORT", 3000))
REQUEST_TIMEOUT = float(os.environ.get("REQUEST_TIMEOUT", "30"))
FILES_DIRECTORY = os.path.join(os.path.dirname(__file__), 'client_files')
# Database
INSTANCE_FOLDER = os.path.join(os.path.dirname(__file__), 'instance')
os.makedirs(INSTANCE_FOLDER, exist_ok=True)
DATABASE_PATH = os.path.join(INSTANCE_FOLDER, 'app.db')
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"
tunnelv2.set_request_timeout(REQUEST_TIMEOUT)

# SQLAlchemy session for proxy
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = scoped_session(sessionmaker(bind=engine, expire_on_commit=False))

# =========================
# Flask app setup
# =========================
app = Flask(__name__)
app.config.update(
    SECRET_KEY=os.environ.get('SECRET_KEY', 'asdkjflaskdjweuqpoposadjfpoa'),
    SQLALCHEMY_DATABASE_URI=DATABASE_URL,
    SQLALCHEMY_TRACK_MODIFICATIONS=False,
    GALLERY_MAX_FILE_BYTES=5 * 1024 * 1024,
    GALLERY_MAX_COUNT=300,
    UPLOAD_FOLDER=os.path.join('static', 'uploads'),
    MAX_CONTENT_LENGTH=5 * 1024 * 1024,
    SESSION_COOKIE_SECURE=False,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SERVER_NAME=None  # Don't set SERVER_NAME for unified routing
)
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
db.init_app(app)
CORS(app, supports_credentials=True)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login_page'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Register blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(projects_bp)

# =========================
# Flask routes (React SPA + API)
# =========================
@app.route('/')
def index():
    return send_from_directory('dist', 'index.html')

@app.route('/dashboard')
@login_required
def dashboard():
    return send_from_directory('dist', 'index.html')


@app.route('/agent.py')
def download_client():
    try:
        file_path = os.path.join(FILES_DIRECTORY, 'client.py')
        if not os.path.exists(file_path):abort(404)
        return send_file(file_path, as_attachment=True, download_name='agent.py')
    except Exception as e:
        return f"error: {str(e)}", 500

@app.route('/assets/<path:path>')
def serve_assets(path):
    return send_from_directory('dist/assets', path)

@app.route('/static/<path:path>')
def serve_static_files(path):
    """Serve static files - no auth required for public assets"""
    return send_from_directory('static', path)

@app.route('/def/<path:path>')
@login_required
def serve_default_files(path):
    return send_from_directory('static/def', path)

@app.route('/api/auth/check', methods=['GET'])
def check_auth():
    return jsonify({
        'authenticated': current_user.is_authenticated,
        'user': current_user.to_dict() if current_user.is_authenticated else None
    })

# ============================================================
# Flask Routes - Projects API
# ============================================================

from flask_login import login_required, current_user

@app.route('/api/projects', methods=['GET'])
@login_required
def list_projects():
    """List user's projects"""
    try:
        projects = Project.query.filter_by(user_id=current_user.id).all()
        return jsonify({
            'success': True,
            'projects': [p.to_dict() for p in projects]
        })
    except Exception as e:
        log.error(f"Error listing projects: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/projects/<int:project_id>', methods=['GET'])
@login_required
def get_project(project_id):
    """Get project details"""
    try:
        project = Project.query.filter_by(id=project_id, user_id=current_user.id).first()
        if not project:
            return jsonify({'success': False, 'message': 'Project not found'}), 404
        return jsonify({
            'success': True,
            'project': project.to_dict()
        })
    except Exception as e:
        log.error(f"Error getting project: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/projects', methods=['POST'])
@login_required
def create_project():
    """Create new project"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('name') or not data.get('agent_id'):
            return jsonify({
                'success': False,
                'message': 'Name and agent_id are required'
            }), 400
        
        # Check if agent exists and belongs to user
        agent = Agent.query.filter_by(id=data['agent_id'], user_id=current_user.id).first()
        if not agent:
            return jsonify({
                'success': False,
                'message': 'Agent not found or access denied'
            }), 404
        
        # Generate subdomain
        subdomain = generate_subdomain(data['name'], current_user.username, db.session, Project)
        
        # Create project
        project = Project(
            user_id=current_user.id,
            agent_id=data['agent_id'],
            name=data['name'],
            path=data.get('path', f'./{data["name"]}'),
            description=data.get('description'),
            command=data.get('command', 'npm run dev'),
            port=data.get('port'),
            subdomain=subdomain,
            is_public=data.get('is_public', True)
        )
        
        db.session.add(project)
        db.session.commit()
        
        log.info(f"Project created: {project.name} (ID: {project.id})")
        
        return jsonify({
            'success': True,
            'project': project.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        log.error(f"Error creating project: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/projects/<int:project_id>', methods=['PUT'])
@login_required
def update_project(project_id):
    """Update project"""
    try:
        project = Project.query.filter_by(id=project_id, user_id=current_user.id).first()
        if not project:
            return jsonify({'success': False, 'message': 'Project not found'}), 404
        
        data = request.get_json()
        
        # Update allowed fields
        if 'name' in data:
            project.name = data['name']
        if 'description' in data:
            project.description = data['description']
        if 'path' in data:
            project.path = data['path']
        if 'command' in data:
            project.command = data['command']
        if 'port' in data:
            project.port = data['port']
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'project': project.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        log.error(f"Error updating project: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/projects/<int:project_id>', methods=['DELETE'])
@login_required
def delete_project(project_id):
    """Delete project"""
    try:
        project = Project.query.filter_by(id=project_id, user_id=current_user.id).first()
        if not project:
            return jsonify({'success': False, 'message': 'Project not found'}), 404
        
        # Check if tunnel is active
        if project.subdomain in tunnelv2.tunnels:
            return jsonify({
                'success': False,
                'message': 'Cannot delete project with active tunnel'
            }), 409
        
        db.session.delete(project)
        db.session.commit()
        
        log.info(f"Project deleted: {project.name} (ID: {project_id})")
        
        return jsonify({'success': True, 'message': 'Project deleted'})
        
    except Exception as e:
        db.session.rollback()
        log.error(f"Error deleting project: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/projects/<int:project_id>/public', methods=['PUT'])
@login_required
def toggle_project_public(project_id):
    """Toggle project public status"""
    try:
        project = Project.query.filter_by(id=project_id, user_id=current_user.id).first()
        if not project:
            return jsonify({'success': False, 'message': 'Project not found'}), 404
        
        data = request.get_json()
        is_public = data.get('is_public')
        
        if is_public is None:
            return jsonify({'success': False, 'message': 'is_public field required'}), 400
        
        project.is_public = is_public
        db.session.commit()
        
        return jsonify({
            'success': True,
            'project': project.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        log.error(f"Error toggling public: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

# ============================================================
# Flask Routes - Agents API
# ============================================================

@app.route('/api/agents', methods=['GET'])
@login_required
def list_agents():
    """List user's agents"""
    try:
        agents = Agent.query.filter_by(user_id=current_user.id).all()
        return jsonify({
            'success': True,
            'agents': [a.to_dict() for a in agents]
        })
    except Exception as e:
        log.error(f"Error listing agents: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/agents', methods=['POST'])
@login_required
def create_agent():
    """Create new agent"""
    try:
        data = request.get_json()
        
        if not data.get('name'):
            return jsonify({'success': False, 'message': 'Name is required'}), 400
        
        # Generate API key
        import secrets
        api_key = secrets.token_hex(32)
        
        agent = Agent(
            user_id=current_user.id,
            name=data['name'],
            api_key=api_key,
            status='offline'
        )
        
        db.session.add(agent)
        db.session.commit()
        
        log.info(f"Agent created: {agent.name} (ID: {agent.id})")
        
        return jsonify({
            'success': True,
            'agent': agent.to_dict(),
            'api_key': api_key  # Only returned once
        }), 201
        
    except Exception as e:
        db.session.rollback()
        log.error(f"Error creating agent: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/agents/<int:agent_id>', methods=['DELETE'])
@login_required
def delete_agent(agent_id):
    """Delete agent"""
    try:
        agent = Agent.query.filter_by(id=agent_id, user_id=current_user.id).first()
        if not agent:
            return jsonify({'success': False, 'message': 'Agent not found'}), 404
        
        db.session.delete(agent)
        db.session.commit()
        
        log.info(f"Agent deleted: {agent.name} (ID: {agent_id})")
        
        return jsonify({'success': True, 'message': 'Agent deleted'})
        
    except Exception as e:
        db.session.rollback()
        log.error(f"Error deleting agent: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

# ============================================================
# Flask Routes - Project Control (placeholder - implement via agents)
# ============================================================

@app.route('/api/projects/<int:project_id>/start', methods=['POST'])
@login_required
def start_project(project_id):
    """Start project via agent"""
    try:
        project = Project.query.filter_by(id=project_id, user_id=current_user.id).first()
        if not project:
            return jsonify({'success': False, 'message': 'Project not found'}), 404
        
        if not project.agent:
            return jsonify({'success': False, 'message': 'No agent assigned'}), 400
        
        if project.agent.status != 'online':
            return jsonify({'success': False, 'message': 'Agent is offline'}), 400
        
        # Set pending action for agent to pick up
        project.pending_action = 'start'
        project.status = 'starting'
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Start command queued',
            'project': project.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        log.error(f"Error starting project: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/projects/<int:project_id>/stop', methods=['POST'])
@login_required
def stop_project(project_id):
    """Stop project via agent"""
    try:
        project = Project.query.filter_by(id=project_id, user_id=current_user.id).first()
        if not project:
            return jsonify({'success': False, 'message': 'Project not found'}), 404
        
        if not project.agent:
            return jsonify({'success': False, 'message': 'No agent assigned'}), 400
        
        project.pending_action = 'stop'
        project.status = 'stopping'
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Stop command queued',
            'project': project.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        log.error(f"Error stopping project: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/projects/<int:project_id>/restart', methods=['POST'])
@login_required
def restart_project(project_id):
    """Restart project via agent"""
    try:
        project = Project.query.filter_by(id=project_id, user_id=current_user.id).first()
        if not project:
            return jsonify({'success': False, 'message': 'Project not found'}), 404
        
        if not project.agent:
            return jsonify({'success': False, 'message': 'No agent assigned'}), 400
        
        project.pending_action = 'restart'
        project.status = 'restarting'
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Restart command queued',
            'project': project.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        log.error(f"Error restarting project: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/projects/<int:project_id>/status', methods=['GET'])
@login_required
def get_project_status(project_id):
    """Get project status with runtime stats"""
    try:
        project = Project.query.filter_by(id=project_id, user_id=current_user.id).first()
        if not project:
            return jsonify({'success': False, 'message': 'Project not found'}), 404
        
        # Check if there's a recent status update from agent
        # For now, return basic status from database
        status_data = {
            'running': project.status == 'running',
            'status': project.status,
            'pid': project.pid,
            'port': project.port,
            'agent_status': project.agent.status if project.agent else None,
            'cpu_usage': 0.0,  # Would come from agent status updates
            'memory_usage': 0.0,  # Would come from agent status updates
            'last_started': project.last_started.isoformat() if project.last_started else None
        }
        
        return jsonify({
            'success': True,
            'status': status_data
        })
        
    except Exception as e:
        log.error(f"Error getting project status: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
# Add these routes to app.py after your existing routes

# ============================================================
# Agent API Endpoints (for client.py polling)
# ============================================================

@app.route('/api/agent/heartbeat', methods=['POST'])
def agent_heartbeat():
    """Agent heartbeat endpoint"""
    api_key = request.headers.get('X-API-Key') or request.headers.get('X-Agent-API-Key')
    
    if not api_key:
        return jsonify({'success': False, 'message': 'Missing API key'}), 401
    
    agent = Agent.query.filter_by(api_key=api_key).first()
    if not agent:
        return jsonify({'success': False, 'message': 'Invalid API key'}), 401
    
    try:
        data = request.get_json()
        agent.status = 'online'
        agent.last_heartbeat = datetime.datetime.utcnow()
        agent.system_info = data.get('system_info', {})
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Heartbeat received'})
    except Exception as e:
        log.error(f"Heartbeat error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/agent/commands', methods=['GET'])
def agent_get_commands():
    """Get pending commands for agent"""
    api_key = request.headers.get('X-API-Key') or request.headers.get('X-Agent-API-Key')
    
    if not api_key:
        return jsonify({'success': False, 'message': 'Missing API key'}), 401
    
    agent = Agent.query.filter_by(api_key=api_key).first()
    if not agent:
        return jsonify({'success': False, 'message': 'Invalid API key'}), 401
    
    try:
        # Get projects with pending actions for this agent
        projects = Project.query.filter_by(
            agent_id=agent.id
        ).filter(
            Project.pending_action.isnot(None)
        ).all()
        
        commands = []
        for project in projects:
            # Create a command entry
            command = Command(
                agent_id=agent.id,
                project_id=project.id,
                action=project.pending_action,
                status='pending'
            )
            db.session.add(command)
            db.session.flush()  # Get the ID
            
            # Clear pending action
            project.pending_action = None
            
            commands.append({
                'id': command.id,
                'action': command.action,
                'project': project.to_dict()
            })
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'commands': commands
        })
    except Exception as e:
        db.session.rollback()
        log.error(f"Get commands error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/agent/commands/<int:command_id>/complete', methods=['POST'])
def agent_complete_command(command_id):
    """Mark command as completed"""
    api_key = request.headers.get('X-API-Key') or request.headers.get('X-Agent-API-Key')
    
    if not api_key:
        return jsonify({'success': False, 'message': 'Missing API key'}), 401
    
    agent = Agent.query.filter_by(api_key=api_key).first()
    if not agent:
        return jsonify({'success': False, 'message': 'Invalid API key'}), 401
    
    try:
        command = Command.query.filter_by(id=command_id, agent_id=agent.id).first()
        if not command:
            return jsonify({'success': False, 'message': 'Command not found'}), 404
        
        data = request.get_json()
        success = data.get('success', False)
        message = data.get('message', '')
        pid = data.get('pid')
        
        command.status = 'completed' if success else 'failed'
        command.result = message
        command.completed_at = datetime.datetime.utcnow()
        
        # Update project status
        project = command.project
        if success:
            if command.action == 'start':
                project.status = 'running'
                project.pid = pid
                project.last_started = datetime.datetime.utcnow()
            elif command.action == 'stop':
                project.status = 'stopped'
                project.pid = None
            elif command.action == 'restart':
                project.status = 'running'
                project.pid = pid
                project.last_started = datetime.datetime.utcnow()
        else:
            project.status = 'error'
        
        db.session.commit()
        
        log.info(f"Command {command_id} completed: {message}")
        
        return jsonify({'success': True, 'message': 'Command completion recorded'})
    except Exception as e:
        db.session.rollback()
        log.error(f"Complete command error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/agent/projects/<int:project_id>/status', methods=['POST'])
def agent_update_status(project_id):
    """Update project runtime status"""
    api_key = request.headers.get('X-API-Key') or request.headers.get('X-Agent-API-Key')
    
    if not api_key:
        return jsonify({'success': False, 'message': 'Missing API key'}), 401
    
    agent = Agent.query.filter_by(api_key=api_key).first()
    if not agent:
        return jsonify({'success': False, 'message': 'Invalid API key'}), 401
    
    try:
        project = Project.query.filter_by(id=project_id, agent_id=agent.id).first()
        if not project:
            return jsonify({'success': False, 'message': 'Project not found'}), 404
        
        data = request.get_json()
        
        # Store runtime stats (you might want a separate table for this)
        # For now, we'll just acknowledge receipt
        
        return jsonify({'success': True})
    except Exception as e:
        log.error(f"Update status error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

# ============================================================
# Catch-all for React Router
# ============================================================

@app.route('/<path:path>')
def serve_react_router(path):
    if path.startswith('api/'):
        return jsonify({'error': 'API endpoint not found'}), 404
    dist_path = os.path.join('dist', path)
    if os.path.exists(dist_path) and os.path.isfile(dist_path):
        return send_from_directory('dist', path)
    return send_from_directory('dist', 'index.html')

# =========================
# aiohttp proxy / tunnel
# =========================
def verify_agent_api_key(api_key: str):
    if not api_key:
        return None
    session = SessionLocal()
    try:
        agent = session.query(Agent).filter_by(api_key=api_key).first()
        log.debug(f"🔍 API key verification: {'✓ Valid agent found' if agent else '❌ No agent found'}")
        if agent:
            log.debug(f"🔍 Agent details: ID={agent.id}, Name={agent.name}, Status={agent.status}")
        return agent
    except Exception as e:
        log.error(f"❌ Error verifying API key: {e}", exc_info=True)
        return None
    finally:
        session.close()

async def tunnel_control_wrapper(request: web.Request):
    log.debug(f"🔍 New tunnel control request received from {request.remote}")
    return await tunnelv2.tunnel_control(
        request,
        verify_agent_api_key,
        SessionLocal,
        Project,
        Agent,
        DOMAIN
    )

async def http_handler_wrapper(request: web.Request):
    async def status_handler(req):
        html = f"""
        <html><body>
        <h1>Proxy Running</h1>
        <p>Domain: {DOMAIN}</p>
        <p>Active tunnels: {len(tunnelv2.tunnels)}</p>
        </body></html>
        """
        return web.Response(text=html, content_type='text/html')

    return await tunnelv2.http_handler(
        request,
        DOMAIN,
        SessionLocal,
        Project,
        status_handler
    )

# =========================
# Unified Request Handler
# =========================

# Create WSGI handler once (reusable)
flask_wsgi_handler = WSGIHandler(app)

async def unified_handler(request: web.Request):
    """
    Single handler that routes all requests:
    - /_tunnel -> WebSocket tunnel connection
    - /health -> Health check
    - *.domain.com/* -> Proxy to local project
    - domain.com/* -> Flask application
    """
    path = request.path
    host = request.headers.get('Host', '').lower()
    
    # Health check endpoint
    if path == '/health':
        return web.json_response({
            'status': 'healthy',
            'active_tunnels': len(tunnelv2.tunnels),
            'domain': DOMAIN
        })
    
    # WebSocket tunnel endpoint
    if path == '/_tunnel':
        log.info(f"🔌 WebSocket tunnel request from {request.remote}")
        return await tunnel_control_wrapper(request)
    
    # Check if this is a subdomain request (proxy to local project)
    subdomain = extract_subdomain(host, DOMAIN)
    
    if subdomain and subdomain != "__invalid__":
        # This is a project subdomain - proxy to local project
        log.debug(f"🌐 Proxying subdomain request: {subdomain}.{DOMAIN}{path}")
        return await http_handler_wrapper(request)
    
    # Root domain or no subdomain - serve Flask app
    log.debug(f"📱 Serving Flask app for: {host}{path}")
    
    # Create a new request with path_info for WSGI handler
    request.match_info['path_info'] = request.path
    return await flask_wsgi_handler(request)

def create_unified_app():
    """Create unified aiohttp application"""
    aio_app = web.Application(client_max_size=50*1024*1024)
    
    # Single catch-all route that handles everything
    aio_app.router.add_route('*', '/{path_info:.*}', unified_handler)
    
    return aio_app

# =========================
# Startup
# =========================
if __name__ == '__main__':
    # Initialize DB
    with app.app_context():
        db.create_all()
        log.info("✅ Database initialized")

    log.info("=" * 70)
    log.info("🚀 STARTING UNIFIED SERVER")
    log.info("=" * 70)
    log.info(f"   Port: {PORT}")
    log.info(f"   Domain: {DOMAIN}")
    log.info(f"   WebSocket Tunnel: /_tunnel")
    log.info(f"   Project Proxy: *.{DOMAIN}")
    log.info(f"   Flask App: {DOMAIN}")
    log.info("=" * 70)
    
    # Run unified aiohttp server (handles everything)
    unified_app = create_unified_app()
    web.run_app(unified_app, host='0.0.0.0', port=PORT, access_log=None)