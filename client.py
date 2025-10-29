import requests
import subprocess
import time
import sys
import os
import platform
import psutil
from datetime import datetime
import signal
import json
import threading
import argparse
import logging
import asyncio
import aiohttp
from pathlib import Path

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"), format="%(asctime)s - %(message)s")
log = logging.getLogger(__name__)

class WebSocketTunnelThread(threading.Thread):
    """
    Runs the WebSocket tunnel in a background thread with its own asyncio loop.
    """
    def __init__(self, server_url, api_key, project_id, local_port):
        super().__init__(daemon=True)
        self.server_url = server_url
        self.api_key = api_key
        self.project_id = project_id
        self.local_port = local_port
        self._stop_event = threading.Event()
        self.loop = None

    def run(self):
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        try:
            self.loop.run_until_complete(self._run_tunnel())
        except Exception as e:
            print(f"[Tunnel] Fatal tunnel error: {e}")
        finally:
            try:
                pending = asyncio.all_tasks(self.loop)
                for task in pending:
                    task.cancel()
                self.loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
            except Exception:
                pass
            self.loop.close()

    async def _run_tunnel(self):
        # Build WebSocket URL - add api_key as query parameter
        if self.server_url.startswith("https://"):
            ws_url = self.server_url.replace("https://", "wss://")
            use_ssl = True
        else:
            ws_url = self.server_url.replace("http://", "ws://")
            use_ssl = False
        
        # Add parameters to URL
        ws_url = f"{ws_url}/_tunnel?project_id={self.project_id}&api_key={self.api_key}"

        print(f"[Tunnel] Connecting to: {ws_url[:ws_url.index('api_key=')]}api_key=***")

        connector = None
        if use_ssl:
            import ssl
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            connector = aiohttp.TCPConnector(
                ssl=ssl_context,
                limit=100,
                limit_per_host=30,
                ttl_dns_cache=300
            )

        async with aiohttp.ClientSession(
            connector=connector,
            headers={
                'User-Agent': 'ProjectAgent/1.0'
            }
        ) as session:
            try:
                ws = await session.ws_connect(
                    ws_url,
                    heartbeat=30,
                    compress=15,
                    max_msg_size=10 * 1024 * 1024
                )
                print(f"✅ [Tunnel] WebSocket tunnel established for project {self.project_id}")
                
                # Wait for connection confirmation
                async for msg in ws:
                    if msg.type == aiohttp.WSMsgType.TEXT:
                        data = json.loads(msg.data)
                        if data.get('type') == 'connected':
                            print(f"✅ [Tunnel] Tunnel active: {data.get('url')}")
                            break
                    elif msg.type == aiohttp.WSMsgType.BINARY:
                        data = json.loads(msg.data)
                        if data.get('type') == 'connected':
                            print(f"✅ [Tunnel] Tunnel active: {data.get('url')}")
                            break
                    elif msg.type == aiohttp.WSMsgType.ERROR:
                        print(f"❌ [Tunnel] Connection error")
                        return
                
                # Handle requests
                await self._handle_requests(ws, session)
                
            except aiohttp.client_exceptions.WSServerHandshakeError as e:
                print(f"❌ [Tunnel] WS handshake failed: {e}")
                print(f"[Tunnel] This usually means:")
                print(f"  1. The proxy server is not running on port 8080")
                print(f"  2. Your reverse proxy (Caddy/Nginx) is not routing /_tunnel correctly")
                print(f"  3. The API key is invalid")
            except Exception as e:
                print(f"❌ [Tunnel] WebSocket connection error: {e}")
                import traceback
                traceback.print_exc()

    async def _handle_requests(self, ws, session):
        while not self._stop_event.is_set():
            msg = await ws.receive()
            if msg.type == aiohttp.WSMsgType.BINARY:
                data = json.loads(msg.data)
                if data.get("type") == "http_request":
                    await self._forward_request(data, ws, session)
            elif msg.type == aiohttp.WSMsgType.TEXT:
                data = json.loads(msg.data)
                if data.get("type") == "http_request":
                    await self._forward_request(data, ws, session)
            elif msg.type == aiohttp.WSMsgType.CLOSE:
                print(f"[Tunnel] WebSocket closed by server")
                break
            elif msg.type == aiohttp.WSMsgType.ERROR:
                print(f"[Tunnel] WebSocket error: {ws.exception()}")
                break

    async def _forward_request(self, request_data, ws, session):
        request_id = request_data["request_id"]
        method = request_data["method"]
        path = request_data["path"]
        query_string = request_data.get("query_string", "")
        headers = request_data.get("headers", {})
        body = request_data.get("body", "")
        
        url = f"http://localhost:{self.local_port}{path}"
        if query_string:
            url += f"?{query_string}"
        
        print(f"[Tunnel] → {method} {path}")
        
        try:
            forward_headers = {}
            skip_headers = {
                'host', 'connection', 'upgrade', 'transfer-encoding',
                'content-encoding', 'accept-encoding'
            }
            for key, value in headers.items():
                if key.lower() not in skip_headers:
                    forward_headers[key] = value
            
            async with session.request(
                method=method,
                url=url,
                headers=forward_headers,
                data=body.encode('utf-8') if body else None,
                timeout=aiohttp.ClientTimeout(total=30),
                allow_redirects=False
            ) as resp:
                response_bytes = await resp.read()
                
                try:
                    response_body = response_bytes.decode('utf-8')
                    is_binary = False
                except UnicodeDecodeError:
                    import base64
                    response_body = base64.b64encode(response_bytes).decode('ascii')
                    is_binary = True
                    print(f"[Tunnel] 📦 Binary response ({len(response_bytes)} bytes)")
                
                response_headers = []
                skip_response_headers = {'transfer-encoding', 'content-encoding'}
                for key, value in resp.headers.items():
                    str_key = str(key)
                    if str_key.lower() not in skip_response_headers:
                        response_headers.append((str_key, str(value)))
                
                response_data = {
                    "type": "http_response",
                    "request_id": request_id,
                    "status": resp.status,
                    "headers": response_headers,
                    "body": response_body,
                    "is_binary": is_binary
                }
                
                await ws.send_str(json.dumps(response_data))
                print(f"[Tunnel] ← {resp.status} {path}")
                
        except Exception as e:
            print(f"[Tunnel] ❌ Error forwarding request: {e}")
            await self._send_error_response(ws, request_id, 500, str(e))

    async def _send_error_response(self, ws, request_id: str, status: int, message: str):
        response_data = {
            "type": "http_response",
            "request_id": request_id,
            "status": status,
            "headers": [("Content-Type", "text/plain")],
            "body": message,
            "is_binary": False
        }
        try:
            await ws.send_str(json.dumps(response_data))
        except Exception:
            pass

    def stop(self):
        self._stop_event.set()
        if self.loop:
            self.loop.call_soon_threadsafe(self.loop.stop)


class ProjectAgent:
    def __init__(self, server_url, api_key, debug_cookies=False):
        self.server_url = server_url.rstrip('/')
        self.api_key = api_key
        self.debug_cookies = debug_cookies
        
        # Include both header formats for compatibility
        self.headers = {
            'X-API-Key': api_key,
            'X-Agent-API-Key': api_key,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'ProjectAgent/1.0'
        }
        
        self.running_processes = {}
        self.tunnel_threads = {}
        self.poll_interval = 5
        self.heartbeat_interval = 30
        self.last_heartbeat = 0
        self.consecutive_errors = 0
        self.max_consecutive_errors = 5
        self.reconnect_delay = 10  # seconds

    def get_system_info(self):
        try:
            return {
                'hostname': platform.node(),
                'platform': platform.system(),
                'platform_version': platform.version(),
                'architecture': platform.machine(),
                'processor': platform.processor(),
                'cpu_count': psutil.cpu_count(),
                'memory_total': psutil.virtual_memory().total,
                'memory_available': psutil.virtual_memory().available,
                'disk_usage': psutil.disk_usage('/').percent,
                'python_version': sys.version
            }
        except Exception as e:
            print(f"⚠️  Error collecting system info: {e}")
            return {}

    def send_heartbeat(self):
        try:
            response = requests.post(
                f'{self.server_url}/api/agent/heartbeat',
                headers=self.headers,
                json={'system_info': self.get_system_info()},
                timeout=10
            )
            if response.status_code == 200:
                self.last_heartbeat = time.time()
                print(f"💓 Heartbeat sent at {datetime.now().strftime('%H:%M:%S')}")
                self.consecutive_errors = 0  # Reset error counter on successful connection
                return True
            else:
                print(f"❌ Heartbeat failed: {response.status_code} - {response.text}")
                self.consecutive_errors += 1
                return False
        except requests.exceptions.RequestException as e:
            print(f"❌ Heartbeat error: {e}")
            self.consecutive_errors += 1
            return False

    def poll_commands(self):
        try:
            response = requests.get(
                f'{self.server_url}/api/agent/commands',
                headers=self.headers,
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                commands = data.get('commands', [])
                if commands:
                    print(f"📬 Received {len(commands)} command(s)")
                self.consecutive_errors = 0  # Reset error counter on successful connection
                return commands
            else:
                print(f"⚠️  Failed to poll commands: {response.status_code}")
                self.consecutive_errors += 1
                return []
        except requests.exceptions.RequestException as e:
            print(f"⚠️  Poll error: {e}")
            self.consecutive_errors += 1
            return []

    def execute_command(self, command):
        command_id = command['id']
        action = command['action']
        project = command['project']
        project_id = project['id']

        print(f"\n{'='*60}")
        print(f"📋 Executing: {action.upper()} for project '{project['name']}'")
        print(f"   Project ID: {project_id}")
        print(f"   Command ID: {command_id}")
        print(f"{'='*60}")

        try:
            if action == 'start':
                success, message, pid = self.start_project(project)
            elif action == 'stop':
                success, message, pid = self.stop_project(project_id)
            elif action == 'restart':
                print("🔄 Stopping project first...")
                self.stop_project(project_id)
                time.sleep(2)
                print("🚀 Starting project...")
                success, message, pid = self.start_project(project)
            else:
                success = False
                message = f"Unknown action: {action}"
                pid = None
            
            self.report_completion(command_id, success, message, pid)
            
            if success:
                print(f"✅ Command completed successfully")
            else:
                print(f"❌ Command failed: {message}")
            
            return success
        except Exception as e:
            error_msg = f"Exception during command execution: {str(e)}"
            print(f"❌ {error_msg}")
            import traceback
            traceback.print_exc()
            self.report_completion(command_id, False, error_msg, None)
            return False

    def start_project(self, project):
        project_id = project['id']
        project_name = project['name']
        project_path = project['path']
        command = project['command']
        port = project.get('port')

        print(f"📝 Project Details:")
        print(f"   Name: {project_name}")
        print(f"   Path: {project_path}")
        print(f"   Command: {command}")
        print(f"   Port: {port if port else 'Not specified'}")

        if project_id in self.running_processes:
            proc = self.running_processes[project_id]
            if proc.poll() is None:
                print(f"⚠️  Project is already running (PID: {proc.pid})")
                return False, "Project is already running", proc.pid

        if not os.path.exists(project_path):
            error_msg = f"Project path does not exist: {project_path}"
            print(f"❌ {error_msg}")
            return False, error_msg, None

        try:
            print(f"🚀 Starting process...")
            env = os.environ.copy()
            if port:
                env['PORT'] = str(port)
            
            is_windows = platform.system() == 'Windows'
            process = subprocess.Popen(
                command,
                cwd=project_path,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                env=env,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if is_windows else 0,
                preexec_fn=os.setsid if not is_windows else None
            )
            
            time.sleep(2)
            
            if process.poll() is not None:
                stdout, stderr = process.communicate()
                error_msg = f"Process exited immediately. Exit code: {process.returncode}"
                if stderr:
                    error_msg += f"\nError: {stderr}"
                print(f"❌ {error_msg}")
                return False, error_msg, None
            
            self.running_processes[project_id] = process
            print(f"✅ Process started successfully (PID: {process.pid})")
            
            # Start log streaming
            log_thread = threading.Thread(
                target=self.stream_logs,
                args=(project_id, process),
                daemon=True
            )
            log_thread.start()
            
            # Start tunnel if port specified
            if port:
                print(f"🔌 Starting WebSocket tunnel for port {port}...")
                self.start_tunnel_thread(project_id, port)
            else:
                print(f"⚠️  No port specified - tunnel not started")
            
            return True, f"Project started successfully (PID: {process.pid})", process.pid
            
        except Exception as e:
            error_msg = f"Failed to start process: {str(e)}"
            print(f"❌ {error_msg}")
            import traceback
            traceback.print_exc()
            return False, error_msg, None

    def stream_logs(self, project_id, process):
        try:
            while process.poll() is None:
                if process.stdout:
                    line = process.stdout.readline()
                    if line:
                        print(f"[{project_id}] {line.rstrip()}")
                time.sleep(0.1)
        except Exception as e:
            print(f"⚠️  Log streaming error: {e}")

    def stop_project(self, project_id):
        if project_id not in self.running_processes:
            print(f"⚠️  Project {project_id} is not running")
            return False, "Project is not running", None
        
        process = self.running_processes[project_id]
        pid = process.pid
        
        try:
            print(f"🛑 Stopping process (PID: {pid})...")
            
            # Stop tunnel first
            if project_id in self.tunnel_threads:
                print(f"🔌 Stopping tunnel...")
                self.stop_tunnel(project_id)
            
            is_windows = platform.system() == 'Windows'
            
            if is_windows:
                subprocess.run(['taskkill', '/F', '/T', '/PID', str(pid)], capture_output=True)
            else:
                try:
                    os.killpg(os.getpgid(pid), signal.SIGTERM)
                except ProcessLookupError:
                    process.terminate()
            
            try:
                process.wait(timeout=5)
                print(f"✅ Process stopped")
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
                print(f"✅ Process force-stopped")
            
            del self.running_processes[project_id]
            return True, f"Project stopped (PID: {pid})", pid
            
        except Exception as e:
            error_msg = f"Error stopping process: {str(e)}"
            print(f"❌ {error_msg}")
            return False, error_msg, pid

    def report_completion(self, command_id, success, message, pid):
        try:
            response = requests.post(
                f'{self.server_url}/api/agent/commands/{command_id}/complete',
                headers=self.headers,
                json={'success': success, 'message': message, 'pid': pid},
                timeout=10
            )
            if response.status_code == 200:
                print(f"📤 Completion reported to server")
                self.consecutive_errors = 0  # Reset error counter on successful connection
            else:
                print(f"⚠️  Failed to report completion: {response.status_code}")
                self.consecutive_errors += 1
        except requests.exceptions.RequestException as e:
            print(f"⚠️  Error reporting completion: {e}")
            self.consecutive_errors += 1

    def start_tunnel_thread(self, project_id, local_port):
        if project_id in self.tunnel_threads:
            print(f"⚠️  Tunnel already running for project {project_id}")
            return
        
        thread = WebSocketTunnelThread(self.server_url, self.api_key, project_id, local_port)
        self.tunnel_threads[project_id] = thread
        thread.start()
        print(f"🔄 WebSocket tunnel thread started for project {project_id}")

    def stop_tunnel(self, project_id):
        if project_id in self.tunnel_threads:
            thread = self.tunnel_threads[project_id]
            thread.stop()
            del self.tunnel_threads[project_id]
            return True
        return False

    def should_restart(self):
        return self.consecutive_errors >= self.max_consecutive_errors

    def run(self):
        print("=" * 70)
        print("🤖 PROJECT AGENT STARTING")
        print("=" * 70)
        print(f"Server: {self.server_url}")
        print(f"API Key: {self.api_key[:8]}...")
        print("=" * 70)

        if not self.send_heartbeat():
            print("❌ Failed to connect to server")
            return

        print("✅ Connected to server")
        print("🔄 Starting main loop...\n")
        
        try:
            while True:
                try:
                    if time.time() - self.last_heartbeat >= self.heartbeat_interval:
                        self.send_heartbeat()
                    
                    commands = self.poll_commands()
                    for command in commands:
                        self.execute_command(command)
                    
                    # Check if we need to restart due to too many consecutive errors
                    if self.should_restart():
                        print(f"⚠️  Too many consecutive errors ({self.consecutive_errors}). Attempting to restart agent...")
                        # Restart the agent by re-executing the script
                        self._restart_agent()
                        return  # Exit current process
                    
                    time.sleep(self.poll_interval)
                except Exception as e:
                    print(f"❌ Unexpected error in main loop: {e}")
                    self.consecutive_errors += 1
                    import traceback
                    traceback.print_exc()
                    time.sleep(self.poll_interval)
        except KeyboardInterrupt:
            print("\n🛑 Shutting down...")
            for project_id in list(self.running_processes.keys()):
                self.stop_project(project_id)
            print("✅ Agent stopped")

    def _restart_agent(self):
        """Restart the agent by re-executing the current script with the same arguments"""
        print("🔄 Restarting agent...")
        
        # Stop all running processes
        for project_id in list(self.running_processes.keys()):
            self.stop_project(project_id)
        
        # Get current script path and arguments
        script = sys.executable
        args = [sys.argv[0]]
        for arg in sys.argv[1:]:
            args.append(arg)
        
        print(f"🚀 Executing: {script} {' '.join(args)}")
        
        # Start a new process
        if platform.system() == 'Windows':
            # Use CREATE_NEW_PROCESS_GROUP to create a new process group
            subprocess.Popen([script] + args, creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
        else:
            # Use setsid to create a new process group
            subprocess.Popen([script] + args, preexec_fn=os.setsid)
        
        print("✅ New agent process started. Exiting current process.")
        # Exit current process
        sys.exit(0)


def main():
    parser = argparse.ArgumentParser(description='Project Management Agent with WebSocket Tunnel')
    parser.add_argument('--server', required=True, help='Server URL')
    parser.add_argument('--api-key', required=True, help='Agent API key')
    parser.add_argument('--poll-interval', type=int, default=5)
    parser.add_argument('--heartbeat-interval', type=int, default=30)
    parser.add_argument('--max-consecutive-errors', type=int, default=5, 
                        help='Maximum consecutive connection errors before restarting')
    parser.add_argument('--reconnect-delay', type=int, default=10,
                        help='Delay in seconds before attempting to reconnect')
    args = parser.parse_args()

    agent = ProjectAgent(args.server, args.api_key)
    agent.poll_interval = args.poll_interval
    agent.heartbeat_interval = args.heartbeat_interval
    agent.max_consecutive_errors = args.max_consecutive_errors
    agent.reconnect_delay = args.reconnect_delay
    agent.run()


if __name__ == '__main__':
    main()