#tunnel.py
import asyncio
import base64
import aiohttp
from aiohttp import web
import logging
import secrets
import time
from collections import defaultdict
from typing import Dict, Optional
from sqlalchemy.orm import scoped_session

try:
    import orjson as jsonlib
    def dumps(o): return jsonlib.dumps(o)
    def loads(b): return jsonlib.loads(b)
except Exception:
    import json as jsonlib
    def dumps(o): return jsonlib.dumps(o).encode("utf-8")
    def loads(b): return jsonlib.loads(b)

# Set up detailed logging
log = logging.getLogger(__name__)
log.setLevel(logging.DEBUG)  # Ensure DEBUG level is enabled

# ============================================================
# Global State
# ============================================================

tunnels: Dict[str, web.WebSocketResponse] = {}
tunnel_to_project: Dict[str, int] = {}
pending_requests: Dict[str, dict] = {}

# Rate limiting: max 100 requests per IP per minute
rate_limit_store = defaultdict(list)
RATE_LIMIT = 100  # requests
RATE_WINDOW = 60  # seconds

REQUEST_TIMEOUT = 30.0  # seconds

# ============================================================
# Rate Limiting
# ============================================================

def check_rate_limit(ip: str) -> bool:
    """Check if IP is within rate limit"""
    now = time.time()
    
    # Clean old entries
    rate_limit_store[ip] = [
        timestamp for timestamp in rate_limit_store[ip]
        if now - timestamp < RATE_WINDOW
    ]
    
    # Check limit
    if len(rate_limit_store[ip]) >= RATE_LIMIT:
        return False
    
    # Add new request
    rate_limit_store[ip].append(now)
    return True


def set_request_timeout(timeout: float):
    """Set the request timeout"""
    global REQUEST_TIMEOUT
    REQUEST_TIMEOUT = timeout


# ============================================================
# Cleanup Task
# ============================================================

async def cleanup_old_requests():
    """Remove stale pending requests every 5 minutes"""
    while True:
        await asyncio.sleep(300)  # 5 minutes
        
        now = time.time()
        stale_requests = []
        
        for request_id, request_data in pending_requests.items():
            # Check if request has timestamp
            if 'timestamp' not in request_data:
                request_data['timestamp'] = now
            
            # Remove requests older than REQUEST_TIMEOUT * 2
            if now - request_data['timestamp'] > REQUEST_TIMEOUT * 2:
                stale_requests.append(request_id)
        
        for request_id in stale_requests:
            pending_requests.pop(request_id, None)
        
        if stale_requests:
            log.info(f"🧹 Cleaned up {len(stale_requests)} stale requests")


# ============================================================
# Header Utilities
# ============================================================

def normalize_incoming_headers(hdrs: aiohttp.typedefs.LooseHeaders) -> dict:
    """Normalize headers to dict"""
    result = {}
    try:
        for key, value in hdrs.items():
            str_key = str(key)
            str_value = str(value)
            result[str_key] = str_value
    except Exception as e:
        log.error(f"Error normalizing headers: {e}, headers type: {type(hdrs)}")
        raise
    return result


# ============================================================
# Tunnel Control WebSocket
# ============================================================

async def tunnel_control(request: web.Request, verify_api_key_func, db_session: scoped_session, 
                        project_model, agent_model, domain: str):
    """
    WebSocket endpoint for tunnel control
    
    Args:
        request: aiohttp request
        verify_api_key_func: function to verify API key (returns Agent)
        db_session: database session factory
        project_model: Project SQLAlchemy model
        agent_model: Agent SQLAlchemy model
        domain: server domain
    """
    # Debug incoming request
    log.debug(f"🔍 New tunnel connection request from {request.remote}")
    log.debug(f"🔍 Request query parameters: {request.query}")
    log.debug(f"🔍 Request headers: {dict(request.headers)}")
    
    ws = web.WebSocketResponse(
        heartbeat=30,
        compress=15,
        max_msg_size=10 * 1024 * 1024
    )
    
    try:
        await ws.prepare(request)
        log.debug("🔍 WebSocket prepared successfully")
    except Exception as e:
        log.error(f"❌ Failed to prepare WebSocket: {e}", exc_info=True)
        return web.Response(text="WebSocket preparation failed", status=500)

    project_id = request.query.get('project_id')
    api_key = request.query.get('api_key')
    
    log.debug(f"🔍 Received project_id: {project_id}")
    log.debug(f"🔍 Received api_key: {'[PRESENT]' if api_key else '[MISSING]'}")
    
    if not project_id or not api_key:
        log.warning("❌ Missing project_id or api_key parameter")
        await ws.send_bytes(dumps({
            "type": "error",
            "message": "Missing project_id or api_key parameter"
        }))
        await ws.close()
        return ws
    
    # Verify API key (returns Agent, not User!)
    agent = verify_api_key_func(api_key)
    log.debug(f"🔍 API key verification result: {agent}")
    
    if not agent:
        log.warning(f"❌ Invalid API key: {api_key[:5]}...")
        await ws.send_bytes(dumps({
            "type": "error",
            "message": "Invalid API key"
        }))
        await ws.close()
        return ws
    
    try:
        project_id = int(project_id)
        log.debug(f"🔍 Converted project_id to int: {project_id}")
    except ValueError:
        log.warning(f"❌ Invalid project_id format: {project_id}")
        await ws.send_bytes(dumps({
            "type": "error",
            "message": "Invalid project_id"
        }))
        await ws.close()
        return ws
    
    # Get project from database and extract all needed data
    db = db_session()
    try:
        # Query project by ID and agent_id (not user_id!)
        project = db.query(project_model).filter_by(id=project_id, agent_id=agent.id).first()
        log.debug(f"🔍 Project lookup result: {project}")
        
        if not project:
            log.warning(f"❌ Project {project_id} not found or access denied for agent {agent.id}")
            await ws.send_bytes(dumps({
                "type": "error",
                "message": f"Project {project_id} not found or access denied"
            }))
            await ws.close()
            return ws
        
        # Extract all needed attributes while session is active
        project_name = project.name
        project_subdomain = project.subdomain
        
        # Get username from the project's owner (User), not from agent
        user = project.user  # Project has relationship to User
        user_username = user.username
        
        log.debug(f"🔍 Project details - name: {project_name}, subdomain: {project_subdomain}, user: {user_username}")
        
        # Generate subdomain if not exists
        if not project_subdomain:
            from subdomainv2 import generate_subdomain
            subdomain = generate_subdomain(project_name, user_username, db, project_model)
            project.subdomain = subdomain
            project_subdomain = subdomain
            db.commit()
            log.debug(f"🔍 Generated new subdomain: {subdomain}")
        
        subdomain = project_subdomain
        
        # Check if tunnel already exists
        if subdomain in tunnels:
            log.warning(f"❌ Tunnel for {subdomain}.{domain} already exists")
            await ws.send_bytes(dumps({
                "type": "error",
                "message": f"Tunnel for {subdomain}.{domain} already exists"
            }))
            await ws.close()
            return ws
        
        # Update project status
        project.status = 'running'
        db.commit()
        log.debug(f"🔍 Updated project status to 'running'")
        
    except Exception as e:
        log.error(f"❌ Database error: {e}", exc_info=True)
        await ws.send_bytes(dumps({
            "type": "error",
            "message": f"Database error: {str(e)}"
        }))
        await ws.close()
        return ws
    finally:
        db.close()
    
    # Store tunnel connection
    tunnels[subdomain] = ws
    tunnel_to_project[subdomain] = project_id
    tunnel_url = f"https://{subdomain}.{domain}"
    
    log.info(f"✓ New tunnel: {tunnel_url} (Project: {project_name}, ID: {project_id}, User: {user_username})")

    # Send connection confirmation
    try:
        await ws.send_bytes(dumps({
            "type": "connected",
            "subdomain": subdomain,
            "url": tunnel_url,
            "project_id": project_id,
            "project_name": project_name
        }))
        log.debug("🔍 Sent connection confirmation message")
    except Exception as e:
        log.error(f"❌ Failed to send confirmation: {e}", exc_info=True)

    # Handle messages
    try:
        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.BINARY:
                try:
                    data = loads(msg.data)
                    
                    if data.get('type') == 'pong':
                        # Heartbeat response
                        continue
                    elif data.get('type') == 'http_response':
                        # Store response for pending request
                        request_id = data.get('request_id')
                        if request_id and request_id in pending_requests:
                            pending_requests[request_id]['response'] = data
                            pending_requests[request_id]['event'].set()
                            
                except Exception as e:
                    log.error(f"Error processing tunnel message: {e}")
                    
            elif msg.type == aiohttp.WSMsgType.TEXT:
                try:
                    data = jsonlib.loads(msg.data)
                    
                    if data.get('type') == 'pong':
                        continue
                    elif data.get('type') == 'http_response':
                        request_id = data.get('request_id')
                        if request_id and request_id in pending_requests:
                            pending_requests[request_id]['response'] = data
                            pending_requests[request_id]['event'].set()
                            
                except Exception as e:
                    log.error(f"Error processing tunnel message: {e}")
                    
            elif msg.type == aiohttp.WSMsgType.ERROR:
                log.error(f"WebSocket error: {ws.exception()}")
                break
            elif msg.type == aiohttp.WSMsgType.CLOSE:
                break
                
    except Exception as e:
        log.error(f"Tunnel error: {e}", exc_info=True)
    finally:
        # Cleanup
        tunnels.pop(subdomain, None)
        tunnel_to_project.pop(subdomain, None)
        
        # Update project status
        db = db_session()
        try:
            project = db.query(project_model).filter_by(id=project_id).first()
            if project:
                project.status = 'stopped'
                db.commit()
                log.debug(f"🔍 Updated project status to 'stopped'")
        except Exception as e:
            log.error(f"❌ Error updating project status: {e}", exc_info=True)
        finally:
            db.close()
        
        log.info(f"✗ Tunnel closed: {subdomain}.{domain} (Project ID: {project_id})")
        
        if not ws.closed:
            await ws.close()

    return ws


# ============================================================
# HTTP Request Handler
# ============================================================

async def http_handler(request: web.Request, domain: str, db_session: scoped_session, 
                      project_model, status_handler_func):
    """
    Handle incoming HTTP requests and route to tunnels
    
    Args:
        request: aiohttp request
        domain: server domain
        db_session: database session factory
        project_model: Project SQLAlchemy model
        status_handler_func: function to handle status page
    """
    from subdomainv2 import extract_subdomain
    
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
        db = db_session()
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


# ============================================================
# Tunnel Stats
# ============================================================

def get_tunnel_stats() -> dict:
    """Get current tunnel statistics"""
    return {
        'active_tunnels': len(tunnels),
        'pending_requests': len(pending_requests),
        'tunnel_subdomains': list(tunnels.keys())
    }


def get_tunnel_by_subdomain(subdomain: str) -> Optional[web.WebSocketResponse]:
    """Get tunnel WebSocket by subdomain"""
    return tunnels.get(subdomain)


def get_project_by_subdomain(subdomain: str) -> Optional[int]:
    """Get project ID by subdomain"""
    return tunnel_to_project.get(subdomain)