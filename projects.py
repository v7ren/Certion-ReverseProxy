# projects.py - Updated to match your frontend
from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from models import db, Project, Agent, Command, ProjectLog
import logging
from datetime import datetime, timedelta
import secrets

logger = logging.getLogger(__name__)

projects_bp = Blueprint('projects', __name__)

# ============================================
# AGENT MANAGEMENT
# ============================================

def find_available_tunnel_port():
    """Find an available port for tunnel (range 10000-20000)"""
    used_ports = set(p.tunnel_port for p in Project.query.filter(Project.tunnel_port.isnot(None)).all())
    
    for port in range(10000, 20000):
        if port not in used_ports:
            return port
    
    raise Exception("No available tunnel ports")

@projects_bp.route('/api/agents', methods=['GET'])
@login_required
def get_agents():
    """Get all agents for current user"""
    try:
        agents = Agent.query.filter_by(user_id=current_user.id).all()
        
        # Mark agents as offline if no heartbeat in last 2 minutes
        for agent in agents:
            if agent.last_heartbeat:
                time_diff = datetime.utcnow() - agent.last_heartbeat
                if time_diff > timedelta(minutes=2):
                    agent.status = 'offline'
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'agents': [agent.to_dict() for agent in agents]
        }), 200
    except Exception as e:
        logger.error(f"Error fetching agents: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to fetch agents'
        }), 500

@projects_bp.route('/api/agents', methods=['POST'])
@login_required
def create_agent():
    """Create new agent (generates API key)"""
    try:
        data = request.get_json()
        
        if not data or 'name' not in data:
            return jsonify({
                'success': False,
                'message': 'Agent name is required'
            }), 400
        
        # Generate secure API key
        api_key = secrets.token_urlsafe(32)
        
        agent = Agent(
            user_id=current_user.id,
            name=data['name'].strip(),
            api_key=api_key,
            status='offline'
        )
        
        db.session.add(agent)
        db.session.commit()
        
        logger.info(f"Agent created: {agent.name} for user {current_user.username}")
        
        return jsonify({
            'success': True,
            'agent': agent.to_dict(),
            'api_key': api_key  # Show only once!
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating agent: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to create agent'
        }), 500

@projects_bp.route('/api/agent/me', methods=['GET'])
def get_agent_info():
    """Get current agent info from API key"""
    # Debug: Log all headers
    logger.info(f"Headers received: {dict(request.headers)}")
    
    api_key = request.headers.get('X-Agent-API-Key')
    logger.info(f"API Key from header: {api_key}")
    
    if not api_key:
        return jsonify({'error': 'Missing API key'}), 401
    
    agent = Agent.query.filter_by(api_key=api_key).first()
    
    if not agent:
        logger.error(f"No agent found for API key: {api_key[:10]}...")
        return jsonify({'error': 'Invalid API key'}), 401
    
    logger.info(f"Agent found: {agent.name} (ID: {agent.id})")
    
    return jsonify({
        'id': agent.id,
        'name': agent.name,
        'status': agent.status,
        'last_heartbeat': agent.last_heartbeat.isoformat() if agent.last_heartbeat else None
    }), 200



@projects_bp.route('/api/agents/<int:agent_id>', methods=['DELETE'])
@login_required
def delete_agent(agent_id):
    """Delete an agent"""
    try:
        agent = Agent.query.filter_by(
            id=agent_id,
            user_id=current_user.id
        ).first_or_404()
        
        # Check if agent has running projects
        running_projects = Project.query.filter_by(
            agent_id=agent_id,
            status='running'
        ).count()
        
        if running_projects > 0:
            return jsonify({
                'success': False,
                'message': f'Cannot delete agent with {running_projects} running projects'
            }), 400
        
        db.session.delete(agent)
        db.session.commit()
        
        logger.info(f"Agent deleted: {agent.name}")
        
        return jsonify({
            'success': True,
            'message': 'Agent deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting agent: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to delete agent'
        }), 500

# ============================================
# PROJECT CRUD (Updated to match your frontend)
# ============================================

@projects_bp.route('/api/projects', methods=['GET'])
@login_required
def get_projects():
    """Get all projects for current user"""
    try:
        projects = Project.query.filter_by(user_id=current_user.id).all()
        return jsonify({
            'success': True,
            'projects': [project.to_dict() for project in projects]
        }), 200
    except Exception as e:
        logger.error(f"Error fetching projects: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to fetch projects'
        }), 500

@projects_bp.route('/api/projects/<int:project_id>', methods=['GET'])
@login_required
def get_project(project_id):
    """Get single project"""
    try:
        project = Project.query.filter_by(
            id=project_id,
            user_id=current_user.id
        ).first_or_404()
        
        return jsonify({
            'success': True,
            'project': project.to_dict()
        }), 200
    except Exception as e:
        logger.error(f"Error fetching project: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Project not found'
        }), 404

@projects_bp.route('/api/projects', methods=['POST'])
@login_required
def create_project():
    """Create new project"""
    try:
        data = request.get_json()
        
        required_fields = ['name', 'path', 'agent_id']
        if not all(field in data for field in required_fields):
            return jsonify({
                'success': False,
                'message': 'Missing required fields: name, path, agent_id'
            }), 400
        
        # Verify agent belongs to user
        agent = Agent.query.filter_by(
            id=data['agent_id'],
            user_id=current_user.id
        ).first()
        
        if not agent:
            return jsonify({
                'success': False,
                'message': 'Invalid agent or agent does not belong to you'
            }), 400
        
        project = Project(
            user_id=current_user.id,
            agent_id=data['agent_id'],
            name=data['name'].strip(),
            path=data['path'].strip(),
            description=data.get('description', ''),
            command=data.get('command', 'npm run dev'),
            port=data.get('port'),
            status='stopped'
        )
        
        db.session.add(project)
        db.session.commit()
        
        logger.info(f"Project created: {project.name} for user {current_user.username}")
        
        return jsonify({
            'success': True,
            'project': project.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating project: {str(e)}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@projects_bp.route('/api/projects/<int:project_id>', methods=['PUT'])
@login_required
def update_project(project_id):
    """Update project"""
    try:
        project = Project.query.filter_by(
            id=project_id,
            user_id=current_user.id
        ).first_or_404()
        
        data = request.get_json()
        
        # Update allowed fields
        allowed_fields = ['name', 'description', 'command', 'port', 'path']
        for field in allowed_fields:
            if field in data:
                setattr(project, field, data[field])
        
        project.updated_at = datetime.utcnow()
        db.session.commit()
        
        logger.info(f"Project updated: {project.name}")
        
        return jsonify({
            'success': True,
            'project': project.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating project: {str(e)}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@projects_bp.route('/api/projects/<int:project_id>', methods=['DELETE'])
@login_required
def delete_project(project_id):
    """Delete project"""
    try:
        project = Project.query.filter_by(
            id=project_id,
            user_id=current_user.id
        ).first_or_404()
        
        # Stop if running
        if project.status == 'running':
            command = Command(
                agent_id=project.agent_id,
                project_id=project.id,
                action='stop',
                status='pending'
            )
            db.session.add(command)
        
        db.session.delete(project)
        db.session.commit()
        
        logger.info(f"Project deleted: {project.name}")
        
        return jsonify({
            'success': True,
            'message': 'Project deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting project: {str(e)}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

# ============================================
# PROJECT CONTROL
# ============================================

@projects_bp.route('/api/projects/<int:project_id>/start', methods=['GET', 'POST'])
@login_required
def start_project(project_id):
    print("=== START PROJECT ROUTE CALLED ===")
    """Send start command to agent"""
    try:
        project = Project.query.filter_by(
            id=project_id,
            user_id=current_user.id
        ).first_or_404()
        
        # Check if agent is online
        if not project.agent or project.agent.status != 'online':
            return jsonify({
                'success': False,
                'message': 'Agent is offline. Please start the agent first.'
            }), 400
        
        # Check if already running
        if project.status == 'running':
            return jsonify({
                'success': False,
                'message': 'Project is already running'
            }), 400
        
        # Create command
        command = Command(
            agent_id=project.agent_id,
            project_id=project.id,
            action='start',
            status='pending'
        )
        db.session.add(command)
        
        project.status = 'starting'
        db.session.commit()
        
        logger.info(f"Start command queued for project: {project.name}")
        
        return jsonify({
            'success': True,
            'message': 'Start command sent to agent',
            'project': project.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error starting project: {str(e)}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@projects_bp.route('/api/projects/<int:project_id>/stop', methods=['GET', 'POST'])
@login_required
def stop_project(project_id):
    """Send stop command to agent"""
    try:
        project = Project.query.filter_by(
            id=project_id,
            user_id=current_user.id
        ).first_or_404()
        
        if project.status not in ['running', 'starting']:
            return jsonify({
                'success': False,
                'message': 'Project is not running'
            }), 400
        
        # Create command
        command = Command(
            agent_id=project.agent_id,
            project_id=project.id,
            action='stop',
            status='pending'
        )
        db.session.add(command)
        
        project.status = 'stopping'
        db.session.commit()
        
        logger.info(f"Stop command queued for project: {project.name}")
        
        return jsonify({
            'success': True,
            'message': 'Stop command sent to agent',
            'project': project.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error stopping project: {str(e)}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@projects_bp.route('/api/projects/<int:project_id>/restart', methods=['GET', 'POST'])
@login_required
def restart_project(project_id):
    """Send restart command to agent"""
    try:
        project = Project.query.filter_by(
            id=project_id,
            user_id=current_user.id
        ).first_or_404()
        
        # Check if agent is online
        if not project.agent or project.agent.status != 'online':
            return jsonify({
                'success': False,
                'message': 'Agent is offline'
            }), 400
        
        # Create command
        command = Command(
            agent_id=project.agent_id,
            project_id=project.id,
            action='restart',
            status='pending'
        )
        db.session.add(command)
        
        project.status = 'restarting'
        db.session.commit()
        
        logger.info(f"Restart command queued for project: {project.name}")
        
        return jsonify({
            'success': True,
            'message': 'Restart command sent to agent',
            'project': project.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error restarting project: {str(e)}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@projects_bp.route('/api/projects/<int:project_id>/status', methods=['GET'])
@login_required
def get_project_status(project_id):
    """Get real-time project status"""
    try:
        project = Project.query.filter_by(
            id=project_id,
            user_id=current_user.id
        ).first_or_404()
        
        # Return status info
        status_data = {
            'running': project.status == 'running',
            'pid': project.pid,
            'cpu_usage': 0,  # Agent can report this later
            'memory_usage': 0,  # Agent can report this later
            'port': project.port,
            'last_started': project.last_started.isoformat() if project.last_started else None
        }
        
        return jsonify({
            'success': True,
            'status': status_data
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching status: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to fetch status'
        }), 500

@projects_bp.route('/api/projects/<int:project_id>/logs', methods=['GET'])
@login_required
def get_project_logs(project_id):
    """Get logs for a project"""
    try:
        project = Project.query.filter_by(
            id=project_id,
            user_id=current_user.id
        ).first_or_404()
        
        limit = request.args.get('limit', 1000, type=int)
        
        logs = ProjectLog.query.filter_by(
            project_id=project_id
        ).order_by(ProjectLog.timestamp.desc()).limit(limit).all()
        
        # Group by type
        stdout_logs = [log.content for log in reversed(logs) if log.log_type == 'stdout']
        stderr_logs = [log.content for log in reversed(logs) if log.log_type == 'stderr']
        
        return jsonify({
            'success': True,
            'logs': {
                'stdout': stdout_logs,
                'stderr': stderr_logs
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching logs: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to fetch logs'
        }), 500

# ============================================
# AGENT API (for client communication)
# ============================================

def verify_agent_api_key():
    """Verify agent API key from header"""
    api_key = request.headers.get('X-Agent-API-Key')
    if not api_key:
        return None
    return Agent.query.filter_by(api_key=api_key).first()

@projects_bp.route('/api/agent/heartbeat', methods=['POST'])
def agent_heartbeat():
    """Agent sends heartbeat to stay online"""
    try:
        agent = verify_agent_api_key()
        if not agent:
            return jsonify({'error': 'Invalid API key'}), 401
        
        agent.last_heartbeat = datetime.utcnow()
        agent.status = 'online'
        
        # Update system info if provided
        data = request.get_json()
        if data and 'system_info' in data:
            agent.system_info = data['system_info']
        
        db.session.commit()
        
        return jsonify({'success': True}), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Heartbeat error: {str(e)}")
        return jsonify({'error': 'Heartbeat failed'}), 500

@projects_bp.route('/api/agent/commands', methods=['GET'])
def get_agent_commands():
    """Agent polls for pending commands"""
    try:
        agent = verify_agent_api_key()
        if not agent:
            return jsonify({'error': 'Invalid API key'}), 401
        
        commands = Command.query.filter_by(
            agent_id=agent.id,
            status='pending'
        ).all()
        
        return jsonify({
            'success': True,
            'commands': [cmd.to_dict() for cmd in commands]
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching commands: {str(e)}")
        return jsonify({'error': 'Failed to fetch commands'}), 500

@projects_bp.route('/api/agent/commands/<int:command_id>/complete', methods=['POST'])
def complete_command(command_id):
    """Agent reports command completion"""
    try:
        agent = verify_agent_api_key()
        if not agent:
            return jsonify({'error': 'Invalid API key'}), 401
        
        command = Command.query.filter_by(
            id=command_id,
            agent_id=agent.id
        ).first_or_404()
        
        data = request.get_json()
        
        command.status = 'completed' if data.get('success') else 'failed'
        command.result = data.get('message')
        command.completed_at = datetime.utcnow()
        
        # Update project status
        project = command.project
        if command.action == 'start':
            if data.get('success'):
                project.status = 'running'
                project.pid = data.get('pid')
                project.last_started = datetime.utcnow()
            else:
                project.status = 'error'
        elif command.action == 'stop':
            if data.get('success'):
                project.status = 'stopped'
                project.pid = None
            else:
                project.status = 'error'
        elif command.action == 'restart':
            if data.get('success'):
                project.status = 'running'
                project.pid = data.get('pid')
                project.last_started = datetime.utcnow()
            else:
                project.status = 'error'
        
        db.session.commit()
        
        return jsonify({'success': True}), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error completing command: {str(e)}")
        return jsonify({'error': 'Failed to complete command'}), 500

@projects_bp.route('/api/agent/logs', methods=['POST'])
def push_logs():
    """Agent pushes logs to server"""
    try:
        agent = verify_agent_api_key()
        if not agent:
            return jsonify({'error': 'Invalid API key'}), 401
        
        data = request.get_json()
        
        if not data or 'project_id' not in data or 'content' not in data:
            return jsonify({'error': 'Invalid data'}), 400
        
        # Verify project belongs to agent
        project = Project.query.filter_by(
            id=data['project_id'],
            agent_id=agent.id
        ).first()
        
        if not project:
            return jsonify({'error': 'Invalid project'}), 400
        
        log = ProjectLog(
            project_id=data['project_id'],
            log_type=data.get('type', 'stdout'),
            content=data['content']
        )
        
        db.session.add(log)
        db.session.commit()
        
        return jsonify({'success': True}), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error pushing logs: {str(e)}")
        return jsonify({'error': 'Failed to push logs'}), 500

# Add this to projects.py

@projects_bp.route('/api/projects/<int:project_id>/public', methods=['PUT', 'PATCH'])
@login_required
def toggle_project_public(project_id):
    """Toggle project public/private status"""
    try:
        data = request.get_json()
        
        if not data or 'is_public' not in data:
            return jsonify({
                'success': False,
                'message': 'Missing is_public field'
            }), 400
        
        is_public = data.get('is_public')
        
        # Find the project
        project = Project.query.filter_by(
            id=project_id,
            user_id=current_user.id
        ).first()
        
        if not project:
            return jsonify({
                'success': False,
                'message': 'Project not found'
            }), 404
        
        # If making public
        if is_public and not project.is_public:
            # Generate subdomain if not exists
            if not project.subdomain:
                subdomain = f"{project.name.lower()}-{current_user.username.lower()}"
                subdomain = subdomain.replace(' ', '-').replace('_', '-')
                
                # Check if subdomain already exists
                existing = Project.query.filter_by(subdomain=subdomain).first()
                if existing and existing.id != project.id:
                    # Add random suffix
                    import random
                    subdomain = f"{subdomain}-{random.randint(1000, 9999)}"
                
                project.subdomain = subdomain
            
            # Assign tunnel port if not exists
            if not project.tunnel_port:
                project.tunnel_port = find_available_tunnel_port()
            
            project.is_public = True
            
        # If making private
        elif not is_public and project.is_public:
            project.is_public = False
            # Keep subdomain and tunnel_port for potential re-enabling
        
        db.session.commit()
        
        logger.info(f"Project {project.name} set to {'public' if is_public else 'private'}")
        
        return jsonify({
            'success': True,
            'message': f"Project is now {'public' if is_public else 'private'}",
            'project': {
                'id': project.id,
                'name': project.name,
                'subdomain': project.subdomain,
                'is_public': project.is_public,
                'tunnel_port': project.tunnel_port,
                'url': f"http://{project.subdomain}.DOMAIN.COM" if project.subdomain and project.is_public else None
            }
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        db.session.rollback()
        logger.error(f"Error toggling project public: {str(e)}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@projects_bp.route('/api/projects/<int:project_id>/make-public', methods=['POST'])
@login_required
def make_project_public(project_id):
    """Enable public access for a project"""
    project = Project.query.filter_by(id=project_id, user_id=current_user.id).first_or_404()
    
    if project.is_public:
        return jsonify({'success': False, 'message': 'Already public'}), 400
    
    # Generate subdomain: projectname-username
    subdomain = f"{project.name.lower()}-{current_user.username.lower()}"
    subdomain = subdomain.replace(' ', '-').replace('_', '-')
    
    # Check if subdomain already exists
    if Project.query.filter_by(subdomain=subdomain).first():
        return jsonify({'success': False, 'message': 'Subdomain already taken'}), 400
    
    # Assign a tunnel port (find next available port)
    tunnel_port = find_available_tunnel_port()
    
    project.is_public = True
    project.subdomain = subdomain
    project.tunnel_port = tunnel_port
    db.session.commit()
    
    return jsonify({
        'success': True,
        'subdomain': f"{subdomain}.DOMAIN.COM",
        'tunnel_port': tunnel_port
    }), 200


# ============================================
# DEBUG & TUNNEL ENDPOINTS
# ============================================

@projects_bp.route('/api/debug/project/<int:project_id>')
@login_required
def debug_project(project_id):
    """Debug endpoint to check project status"""
    try:
        project = Project.query.filter_by(
            id=project_id,
            user_id=current_user.id
        ).first_or_404()
        
        # Project info
        project_info = {
            'id': project.id,
            'name': project.name,
            'subdomain': project.subdomain,
            'status': project.status,
            'port': project.port,
            'tunnel_port': project.tunnel_port,
            'is_public': project.is_public,
            'pid': project.pid,
            'last_started': project.last_started.isoformat() if project.last_started else None
        }
        
        # Agent info
        agent_info = None
        if project.agent:
            seconds_since_heartbeat = None
            if project.agent.last_heartbeat:
                seconds_since_heartbeat = (datetime.utcnow() - project.agent.last_heartbeat).total_seconds()
            
            agent_info = {
                'id': project.agent.id,
                'name': project.agent.name,
                'status': project.agent.status,
                'last_heartbeat': project.agent.last_heartbeat.isoformat() if project.agent.last_heartbeat else None,
                'seconds_since_heartbeat': seconds_since_heartbeat,
            }
        
        from tunnels import active_tunnels
        
        # Determine if project can be accessed
        has_agent = project.agent is not None
        agent_online = project.agent.status == 'online' if project.agent else False
        is_running = project.status == 'running'
        tunnel_active = project.id in active_tunnels
        
        return jsonify({
            'project': project_info,
            'agent': agent_info,
            'tunnel': {
                'is_registered': tunnel_active,
                'tunnel_info': active_tunnels.get(project.id)
            },
            'checks': {
                'has_agent': has_agent,
                'agent_online': agent_online,
                'is_running': is_running,
                'is_public': project.is_public,
                'has_subdomain': project.subdomain is not None,
                'tunnel_active': tunnel_active,
                'can_access': all([
                    has_agent, 
                    agent_online, 
                    is_running, 
                    tunnel_active,
                    project.is_public,
                    project.subdomain is not None
                ])
            }
        }), 200
        
    except Exception as e:
        import traceback
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

@projects_bp.route('/api/debug/register-tunnel/<int:project_id>', methods=['POST'])
@login_required
def debug_register_tunnel(project_id):
    """Debug: Manually register tunnel for testing"""
    from tunnels import register_tunnel as reg_tunnel
    
    try:
        project = Project.query.filter_by(
            id=project_id,
            user_id=current_user.id
        ).first_or_404()
        
        data = request.json or {}
        local_port = data.get('local_port', 3000)  # Default to 3000
        
        success = reg_tunnel(project_id, project.agent_id, local_port, '127.0.0.1')
        
        return jsonify({
            'success': success,
            'project_id': project_id,
            'local_port': local_port,
            'message': 'Tunnel registered successfully' if success else 'Failed to register tunnel'
        }), 200 if success else 500
        
    except Exception as e:
        logger.error(f"Error in debug_register_tunnel: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
