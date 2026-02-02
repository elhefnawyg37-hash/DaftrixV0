#!/usr/bin/env python3
"""
Daftrix ERP Headless Launcher
Version 1.0 - CLI Version for Cloud Servers

Usage:
    python headless_launcher.py [--port 3001] [--ngrok] [--no-install]

Features:
- Starts the Node.js Server
- Auto-installs dependencies (npm install)
- Optional Ngrok tunneling
- Graceful shutdown on Ctrl+C
"""

import sys
import os
import time
import subprocess
import threading
import signal
import socket
import urllib.request
import logging
import logging.handlers
import argparse
import json
from datetime import datetime

# ============================================
# CONFIGURATION
# ============================================
DEFAULT_PORT = 3001
LOG_DIR = os.path.join(os.getcwd(), "logs")
LOG_FILE = os.path.join(LOG_DIR, "headless_launcher.log")
NGROK_DOMAIN = "robbi-unglutted-oretha.ngrok-free.dev"

# ============================================
# LOGGING SETUP
# ============================================
def setup_logging():
    os.makedirs(LOG_DIR, exist_ok=True)
    logger = logging.getLogger("DaftrixHeadless")
    logger.setLevel(logging.DEBUG)
    
    if logger.handlers:
        return logger
    
    # File handler
    file_handler = logging.handlers.RotatingFileHandler(
        LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=5, encoding='utf-8'
    )
    file_handler.setLevel(logging.DEBUG)
    file_formatter = logging.Formatter(
        '%(asctime)s | %(levelname)-8s | %(funcName)s:%(lineno)d | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(file_formatter)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter('[%(levelname)s] %(message)s')
    console_handler.setFormatter(console_formatter)
    
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    return logger

logger = setup_logging()

# ============================================
# UTILITY FUNCTIONS
# ============================================
def is_port_in_use(port):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            return s.connect_ex(('localhost', int(port))) == 0
    except:
        return False

def kill_port(port):
    """Attempt to kill process on port (Cross-platform attempt)"""
    logger.info(f"Attempting to free port {port}")
    try:
        if sys.platform == 'win32':
            cmd = f'netstat -ano | findstr :{port}'
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            for line in result.stdout.strip().split('\n'):
                if f':{port}' in line and 'LISTENING' in line:
                    parts = line.split()
                    if len(parts) >= 5:
                        pid = parts[-1]
                        subprocess.run(f'taskkill /F /PID {pid}', shell=True, 
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                        logger.info(f"Killed PID {pid}")
        else:
            # Linux/Unix
            cmd = f"lsof -t -i:{port}"
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            pids = result.stdout.strip().split()
            for pid in pids:
                if pid:
                    subprocess.run(f"kill -9 {pid}", shell=True)
                    logger.info(f"Killed PID {pid}")
    except Exception as e:
        logger.error(f"Error killing port {port}: {e}")

# ============================================
# SERVER MANAGER
# ============================================
class ServerManager:
    def __init__(self, port=DEFAULT_PORT, use_ngrok=False, no_install=False):
        self.port = port
        self.use_ngrok = use_ngrok
        self.skip_install = no_install
        self.server_process = None
        self.ngrok_process = None
        self.running = True
        
    def start(self):
        logger.info(f"Starting Daftrix ERP Server on port {self.port}...")
        
        # 1. Free Port
        if is_port_in_use(self.port):
            logger.warning(f"Port {self.port} is in use. Attempting to free it...")
            kill_port(self.port)
            time.sleep(1)
            
        # 2. Start Server
        self._run_server()
        
        # 3. Start Ngrok if requested
        if self.use_ngrok:
            # Wait a bit for server to init
            time.sleep(2) 
            self._start_ngrok()
            
        # 4. Monitor Loop
        try:
            while self.running:
                # Check if server is still alive
                if self.server_process and self.server_process.poll() is not None:
                    logger.error("Server process exited unexpectedly!")
                    self.running = False
                    break
                    
                # Check ngrok if active
                if self.use_ngrok and self.ngrok_process and self.ngrok_process.poll() is not None:
                    logger.error("Ngrok process exited unexpectedly!")
                    # We can try to restart ngrok, or just log it
                    self.use_ngrok = False
                
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Received stop signal...")
        finally:
            self.stop()

    def _run_server(self):
        try:
            env = os.environ.copy()
            env["PORT"] = str(self.port)
            env["NODE_ENV"] = "production"
            
            server_dir = os.path.join(os.getcwd(), "server")
            
            # Use .env.test_clients if available
            test_env_file = os.path.join(server_dir, ".env.test_clients")
            env_file = os.path.join(server_dir, ".env")
            if os.path.exists(test_env_file):
                import shutil
                shutil.copy2(test_env_file, env_file)
                logger.info("Using test client configuration (.env.test_clients)")

            # NPM Install logic
            if not self.skip_install:
                self._check_and_install_deps(server_dir, env)

            # Determine start command
            start_cmd = self._get_start_command(server_dir)
            logger.info(f"Server start command: {' '.join(start_cmd)}")
            
            # Start Process
            self.server_process = subprocess.Popen(
                start_cmd,
                cwd=server_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                shell=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                env=env
            )
            
            # Verify startup (non-blocking read would be complex without threads, 
            # so we'll just spawn a tailored reader thread)
            threading.Thread(target=self._log_server_output, daemon=True).start()
            
        except Exception as e:
            logger.error(f"Failed to start server: {e}")
            self.running = False

    def _get_start_command(self, server_dir):
        # Check for compiled JS
        compiled_js = os.path.join(server_dir, "dist", "server", "index.js")
        if os.path.exists(compiled_js):
            logger.info("Mode: Production (Compiled JS)")
            return ["node", "dist/server/index.js"]
        
        # Dev mode / ts-node
        ts_node = os.path.join(server_dir, "node_modules", ".bin", "ts-node")
        if sys.platform == 'win32':
            ts_node += ".cmd"
            
        if os.path.exists(ts_node):
            return [ts_node, "index.ts"]
        else:
            # Fallback
            return ["npx", "--yes", "ts-node", "index.ts"]

    def _check_and_install_deps(self, server_dir, env):
        node_modules = os.path.join(server_dir, "node_modules")
        pkg_json = os.path.join(server_dir, "package.json")
        marker = os.path.join(server_dir, ".npm_install_marker")
        
        needs_install = False
        if not os.path.exists(node_modules):
            needs_install = True
            logger.info("node_modules missing, installing...")
        elif os.path.exists(pkg_json):
             if not os.path.exists(marker) or os.path.getmtime(pkg_json) > os.path.getmtime(marker):
                 needs_install = True
                 logger.info("package.json updated, reinstalling...")
        
        if needs_install:
            logger.info("Running npm install...")
            subprocess.run(["npm", "install", "--legacy-peer-deps"], 
                          cwd=server_dir, shell=True, env=env, check=False)
            with open(marker, "w") as f:
                f.write(str(time.time()))

    def _log_server_output(self):
        """Reads server stdout and logs it"""
        if not self.server_process:
            return
        
        for line in iter(self.server_process.stdout.readline, ''):
            line = line.strip()
            if line:
                if "Error" in line or "error" in line:
                    logger.error(f"[Server] {line}")
                else:
                    logger.info(f"[Server] {line}")
                
                # Check ready state
                if "Server is running" in line:
                    logger.info("✅ SERVER IS READY AND RUNNING!")

    def _start_ngrok(self):
        logger.info("Starting Ngrok...")
        # Platform specific executable check
        ngrok_exe = "ngrok.exe" if sys.platform == 'win32' else "./ngrok"
        ngrok_path = os.path.join(os.getcwd(), ngrok_exe)
        
        if not os.path.exists(ngrok_path):
            # Try global
            import shutil
            if shutil.which("ngrok"):
                ngrok_path = "ngrok"
            else:
                logger.error("Ngrok executable not found! Skipping.")
                return

        cmd = [ngrok_path, "http", f"--url={NGROK_DOMAIN}", str(self.port)]
        logger.info(f"Ngrok command: {' '.join(cmd)}")
        
        try:
            self.ngrok_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE, # Capture stderr too
                text=True
            )
            logger.info(f"Ngrok started! Access at: https://{NGROK_DOMAIN}")
            
            # Watch ngrok output in thread
            def watch_ngrok():
                if self.ngrok_process:
                    out, err = self.ngrok_process.communicate()
                    if self.running and self.ngrok_process.returncode != 0:
                        logger.error(f"Ngrok exited with error: {err}")
            
            threading.Thread(target=watch_ngrok, daemon=True).start()
            
        except Exception as e:
            logger.error(f"Failed to start ngrok: {e}")

    def stop(self):
        logger.info("Shutting down...")
        self.running = False
        
        # Stop Ngrok
        if self.ngrok_process:
            try:
                self.ngrok_process.terminate()
                self.ngrok_process.wait(timeout=2)
            except:
                self.ngrok_process.kill()
        
        # Stop Server
        if self.server_process:
            try:
                # On Windows, terminate() might not kill the whole tree (npm -> node)
                # We use more aggressive kill in kill_port if needed, 
                # but let's try graceful first
                self.server_process.terminate()
                self.server_process.wait(timeout=3)
            except:
                logger.warning("Forcing server kill...")
                try:
                    self.server_process.kill()
                except:
                    pass
            
            # Cleanup port to be sure
            kill_port(self.port)
            
        logger.info("Shutdown complete.")

# ============================================
# MAIN ENTRY
# ============================================
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Daftrix ERP Headless Launcher")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Server port (default: 3001)")
    parser.add_argument("--ngrok", action="store_true", help="Enable Ngrok tunneling")
    parser.add_argument("--no-install", action="store_true", help="Skip npm install check")
    
    args = parser.parse_args()
    
    manager = ServerManager(port=args.port, use_ngrok=args.ngrok, no_install=args.no_install)
    manager.start()
