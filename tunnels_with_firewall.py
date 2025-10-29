import asyncio
import base64
import json
import logging
import os
import secrets
import time
from typing import Dict, Optional, Any, Callable, List, Tuple
import datetime
import aiohttp
from aiohttp import web
from sqlalchemy.orm import scoped_session

# Set up logging
log = logging.getLogger(__name__)
log.setLevel(logging.DEBUG)

# Configure console handler
if not log.handlers:
    ch = logging.StreamHandler()
    ch.setLevel(logging.DEBUG)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    ch.setFormatter(formatter)
    log.addHandler(ch)

# Global storage for active tunnels
tunnels = {}  # Maps subdomain to websocket connection
tunnel_to_project = {}  # Maps subdomain to project_id
pending_requests = {}  # Maps request_id to {event, response}

# Request timeout in seconds
REQUEST_TIMEOUT = 30.0

def set_request_timeout(timeout: float):
    """Set the timeout for tunnel requests"""
    global REQUEST_TIMEOUT
    REQUEST_TIMEOUT = timeout

# Rate limiting
rate_limits = {}  # Maps IP to {count, timestamp}
RATE_LIMIT_MAX = 100  # Maximum requests per minute
RATE_LIMIT_WINDOW = 60  # Window in seconds

def check_rate_limit(ip: str) -> bool:
    """
    Check if an IP has exceeded the rate limit
    
    Args:
        ip: IP address
        
    Returns:
        True if within rate limit, False if exceeded
    """
    now = time.time()
    
    if ip not in rate_limits:
        rate_limits[ip] = {'count': 1, 'timestamp': now}
        return True
        
    # Reset counter if window has passed
    if now - rate_limits[ip]['timestamp'] > RATE_LIMIT_WINDOW:
        rate_limits[ip] = {'count': 1, 'timestamp': now}
        return True
        
    # Increment counter
    rate_limits[ip]['count'] += 1
    
    # Check if limit exceeded
    if rate_limits[ip]['count'] > RATE_LIMIT_MAX:
        return False
        
    return True

def cleanup_old_requests():
    """Remove expired requests from the pending_requests dict"""
    now = time.time()
    to_remove = []
    
    for req_id, req_data in pending_requests.items():
        if now - req_data['timestamp'] > REQUEST_TIMEOUT:
            to_remove.append(req_id)
            
    for req_id in to_remove:
        pending_requests.pop(req_id, None)
        
    if to_remove:
        log.debug(f"Cleaned up {len(to_remove)} expired requests")

# Schedule periodic cleanup
async def cleanup_task():
    """Background task to clean up expired requests"""
    while True:
        await asyncio.sleep(60)  # Run every minute
        cleanup_old_requests()

# Start the cleanup task

# JSON serialization/deserialization with binary support
def dumps(o):
    """Serialize object to JSON"""
    return json.dumps(o).encode('utf-8')

def loads(b):
    """Deserialize JSON to object"""
    return json.loads(b.decode('utf-8'))

def normalize_incoming_headers(hdrs: aiohttp.typedefs.LooseHeaders) -> Dict[str, str]:
    """
    Normalize request headers to a simple dict
    
    Args:
        hdrs: aiohttp headers
        
    Returns:
        Dict of header name to value
    """
    result = {}
    
    for k, v in hdrs.items():
        k = k.lower()
        
        # Skip hop-by-hop headers
        if k in ('connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
                 'te', 'trailers', 'transfer-encoding', 'upgrade'):
            continue
            
        # Skip host header (will be set by the client)
        if k == 'host':
            continue
            
        result[k] = v
        
    return result

def get_project_by_subdomain(subdomain: str):
    """
    Get project by subdomain (placeholder for database lookup)
    
    Args:
        subdomain: Subdomain to look up
        
    Returns:
        Project object or None
    """
    # This function should be implemented by the caller
    # and passed to the tunnel_control function
    pass

def get_tunnel_by_subdomain(subdomain: str):
    """
    Get tunnel by subdomain
    
    Args:
        subdomain: Subdomain to look up
        
    Returns:
        WebSocket connection or None
    """
    return tunnels.get(subdomain)

def get_tunnel_stats():
    """
    Get tunnel statistics
    
    Returns:
        Dict with tunnel stats
    """
    return {
        'active_tunnels': len(tunnels),
        'pending_requests': len(pending_requests),
    }

async def tunnel_control(request: web.Request, verify_api_key_func, db_session: scoped_session,
                        project_model, agent_model, domain: str):
    """
    WebSocket handler for tunnel control
    
    Args:
        request: aiohttp request
        verify_api_key_func: Function to verify API key
        db_session: Database session factory
        project_model: Project model class
        agent_model: Agent model class
        domain: Domain name
    """
    # Extract query parameters
    query = request.query
    project_id = query.get('project_id')
    api_key = query.get('api_key')
    
    # Validate parameters
    if not project_id or not api_key:
        return web.Response(text="Missing required parameters", status=400)
        
    log.debug(f"🔍 Received project_id: {project_id}")
    log.debug(f"🔍 Received api_key: {'[PRESENT]' if api_key else '[MISSING]'}")
    
    # Verify API key
    agent = verify_api_key_func(api_key)
    log.debug(f"🔍 API key verification result: {agent}")
    
    if not agent:
        return web.Response(text="Invalid API key", status=401)
        
    # Convert project_id to int
    try:
        project_id = int(project_id)
        log.debug(f"🔍 Converted project_id to int: {project_id}")
    except ValueError:
        return web.Response(text="Invalid project ID", status=400)
        
    # Get project from database
    db = db_session()
# In tunnels_with_firewall.py, in the tunnel_control function:

# Find this section (around line 240-250):
    try:
        project = db.query(project_model).filter_by(id=project_id).first()
        log.debug(f"🔍 Project lookup result: {project}")
        
        if not project:
            return web.Response(text=f"Project not found: {project_id}", status=404)
            
        # Validate that the project belongs to the agent
        if project.agent_id != agent.id:
            return web.Response(
                text=f"Project {project_id} does not belong to agent {agent.id}",
                status=403
            )
        
        # Store project info before closing the session
        project_name = project.name
        
        # Get username safely
        try:
            username = project.user.username
        except Exception:
            username = "unknown"
            
        # Get or generate subdomain
        from subdomain_handling import generate_subdomain, extract_subdomain
        
        if not project.subdomain:
            project.subdomain = generate_subdomain(
                project_name=project_name,
                username=username,
                db=db,
                project_model=project_model
            )
            db.commit()
            
        subdomain = project.subdomain
        log.debug(f"🔍 Project details - name: {project_name}, subdomain: {subdomain}, user: {username}")
        
        # Update project status
        try:
            # Try with timestamp (float)
            project.last_started = time.time()
            project.status = "running"
            db.commit()
        except Exception as e:
            db.rollback()
            log.debug(f"Timestamp update failed: {e}, trying datetime")
            
            # Try with datetime if timestamp fails
            try:
                project.last_started = datetime.datetime.utcnow()
                project.status = "running"
                db.commit()
            except Exception as e2:
                db.rollback()
                log.error(f"Both timestamp and datetime updates failed: {e2}")
                # Continue without updating last_started
                project.status = "running"
                db.commit()
        
        log.debug(f"🔍 Updated project status to 'running'")
        
    except Exception as e:
        db.rollback()
        log.error(f"Error setting up tunnel: {e}", exc_info=True)
        return web.Response(text=f"Error: {e}", status=500)
    finally:
        db.close()
    # Set up WebSocket
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    
    # Register the tunnel
    tunnels[subdomain] = ws
    tunnel_to_project[subdomain] = project_id
    
    # Log the new tunnel
    log.info(f"✓ New tunnel: https://{subdomain}.{domain} (Project: {project_name}, ID: {project_id}, User: {username})")

    
    # Send connection confirmation
    await ws.send_bytes(dumps({
        "type": "connected",
        "subdomain": subdomain,
        "url": f"https://{subdomain}.{domain}"
    }))
    log.debug(f"🔍 Sent connection confirmation message")
    
    try:
        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.BINARY or msg.type == aiohttp.WSMsgType.TEXT:
                try:
                    # Handle both binary and text messages
                    if msg.type == aiohttp.WSMsgType.BINARY:
                        data = loads(msg.data)
                    else:  # TEXT
                        data = json.loads(msg.data)
                        
                    msg_type = data.get("type")
                    log.debug(f"Received WebSocket {msg.type} message: {msg_type}")
                    
                    if msg_type == "http_response":
                        # Handle HTTP response from tunnel
                        request_id = data.get("request_id")
                        if request_id in pending_requests:
                            pending_requests[request_id]['response'] = data
                            pending_requests[request_id]['event'].set()
                        else:
                            log.warning(f"Received response for unknown request ID: {request_id}")
                    else:
                        log.warning(f"Unknown message type: {msg_type}")
                except Exception as e:
                    log.error(f"Error processing message: {e}", exc_info=True)
            elif msg.type == aiohttp.WSMsgType.ERROR:
                log.error(f"WebSocket error: {ws.exception()}")
                break
    finally:
        # Clean up when the connection is closed
        if subdomain in tunnels:
            del tunnels[subdomain]
        if subdomain in tunnel_to_project:
            del tunnel_to_project[subdomain]
        log.info(f"❌ Tunnel closed: {subdomain}.{domain}")
        
    return ws

async def http_handler(request: web.Request, domain: str, db_session: scoped_session, 
                      project_model, status_handler_func, firewall_rule_model=None):
    """
    Handle incoming HTTP requests and route to tunnels
    """
    # Start the cleanup task if it hasn't been started yet
    global _cleanup_task_started
    if not globals().get('_cleanup_task_started', False):
        loop = asyncio.get_running_loop()
        loop.create_task(cleanup_task())
        globals()['_cleanup_task_started'] = True
    from subdomain_handling import extract_subdomain
    
    # Get client IP (Cloudflare-aware)
    client_ip = request.headers.get('CF-Connecting-IP') or \
                request.headers.get('X-Forwarded-For', '').split(',')[0].strip() or \
                request.remote or 'unknown'
    
    # Check rate limit
    if not check_rate_limit(client_ip):
        log.warning(f"⚠️  Rate limit exceeded for IP: {client_ip}")
        return web.Response(
            text="Rate limit exceeded. Maximum 100 requests per minute.",
            status=429
        )
    
    host = request.headers.get("Host", "")
    subdomain = extract_subdomain(host, domain)
    
    if subdomain == "__invalid__":
        return web.Response(text=f"Invalid domain: {host}", status=404)

    if subdomain is None:
        return await status_handler_func(request)

    ws = tunnels.get(subdomain)
    if not ws:
        # Create a direct database session instead of using Flask's scoped session
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        
        # Get the database path from your app configuration
        INSTANCE_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance')
        DATABASE_PATH = os.path.join(INSTANCE_FOLDER, 'app.db')
        DATABASE_URL = f"sqlite:///{DATABASE_PATH}"
        
        engine = create_engine(DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        db = SessionLocal()
        try:
            project = db.query(project_model).filter_by(subdomain=subdomain).first()
            if project:
                return web.Response(
                    text=f"Project '{project.name}' exists but tunnel is not active.\n"
                         f"Please start the project to activate the tunnel.\n"
                         f"Subdomain: {subdomain}.{domain}",
                    status=503
                )
        finally:
            db.close()
        
        return web.Response(
            text=f"Tunnel not found: {subdomain}.{domain}",
            status=404
        )

    # Get the project ID for this subdomain
    project_id = tunnel_to_project.get(subdomain)
    if not project_id:
        return web.Response(
            text=f"Project ID not found for subdomain: {subdomain}",
            status=500
        )
    
    # Check firewall rules if firewall_rule_model is provided
# Check firewall rules if firewall_rule_model is provided
    if firewall_rule_model:
        try:
            method = request.method
            path = request.path
            
            # Use our modified firewall implementation that doesn't rely on Flask context
            try:
                import firewall_aiohttp
                
                # Pass client_ip to the firewall check
                is_blocked, reason = firewall_aiohttp.is_request_blocked(
                    project_id, firewall_rule_model, method, path, client_ip
                )
                
                if is_blocked:
                    log.warning(f"🛑 [Firewall] Blocked request: {method} {path} - {reason} - IP: {client_ip}")
                    return web.Response(
                        text=f"Forbidden: {reason}\n\nYour request has been logged. An administrator may temporarily approve access.",
                        status=403,
                        headers={
                            "X-Firewall-Blocked": "true",
                            "X-Firewall-Reason": reason,
                            "X-Firewall-Request-Logged": "true"
                        }
                    )
            except ImportError as e:
                log.error(f"Error importing firewall module: {e}")
        except Exception as e:
            # Log the error but continue processing the request
            log.error(f"Error checking firewall rules: {e}", exc_info=True)

    request_id = secrets.token_hex(8)
    event = asyncio.Event()
    pending_requests[request_id] = {
        'event': event,
        'response': None,
        'timestamp': time.time()
    }

    query_string = request.query_string

    try:
        body = await request.read()

        payload = {
            "type": "http_request",
            "request_id": request_id,
            "method": request.method,
            "path": request.path,
            "query_string": query_string,
            "headers": normalize_incoming_headers(request.headers),
            "body": body.decode("utf-8", errors="ignore")
        }

        # Add timeout to prevent hanging
        try:
            await asyncio.wait_for(
                ws.send_bytes(dumps(payload)),
                timeout=5.0
            )
        except asyncio.TimeoutError:
            log.error(f"Timeout sending request to tunnel: {subdomain}")
            return web.Response(text="Tunnel send timeout", status=504)
        
        if log.isEnabledFor(logging.DEBUG):
            log.debug(f"→ {request.method} {subdomain}.{domain}{request.path}")

        # Wait for response
        try:
            await asyncio.wait_for(event.wait(), timeout=REQUEST_TIMEOUT)
        except asyncio.TimeoutError:
            log.warning(f"Timeout waiting for response from tunnel: {subdomain}")
            return web.Response(text="Tunnel timeout", status=504)

        response_data = pending_requests[request_id]['response']
        
        if not response_data:
            return web.Response(text="No response from tunnel", status=502)

        status = int(response_data.get("status", 200))
        resp = web.Response(status=status)

        headers_data = response_data.get("headers", {})
        
        if isinstance(headers_data, dict):
            headers_items = headers_data.items()
        else:
            headers_items = headers_data
            
        for key, value in headers_items:
            k = str(key).strip()
            if not k:
                continue
            lk = k.lower()
            if lk in ("transfer-encoding", "content-length", "content-encoding"):
                continue
            resp.headers.add(k, str(value))

        # Handle both text and binary responses
        body_data = response_data.get("body", "")
        is_binary = response_data.get("is_binary", False)
        
        if is_binary:
            # Decode base64 binary data (images, PDFs, etc.)
            try:
                resp.body = base64.b64decode(body_data)
            except Exception as e:
                log.error(f"Error decoding binary response: {e}")
                resp.body = b""
        elif isinstance(body_data, bytes):
            resp.body = body_data
        else:
            resp.body = str(body_data).encode("utf-8")

        return resp

    except Exception as e:
        log.error(f"Error routing request: {e}", exc_info=True)
        return web.Response(text=f"Tunnel error: {e}", status=502)
    finally:
        pending_requests.pop(request_id, None)

def start_cleanup_task():
    """Start the background task to clean up expired requests"""
    loop = asyncio.get_event_loop()
    if loop.is_running():
        loop.create_task(cleanup_task())
    else:
        # If no loop is running, we'll start the task later when needed
        pass