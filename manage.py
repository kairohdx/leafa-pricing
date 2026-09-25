"""Cross-platform entry point. Run `python manage.py --help` from any directory."""

import argparse
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import time
import venv

ROOT = Path(__file__).resolve().parent


def python_path():
    return ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def run(command):
    return subprocess.run([str(arg) for arg in command], cwd=ROOT, check=True)


def main():
    parser = argparse.ArgumentParser(description="Leafa: setup, local API/frontend and Docker API/PostgreSQL.")
    parser.add_argument("command", choices=["setup", "local", "docker-up", "docker-down", "docker-logs"])
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--front-port", type=int, default=5173)
    parser.add_argument("--api-only", action="store_true", help="Install/run only the API (setup/local).")
    parser.add_argument("--seed", action="store_true", help="Create demo accounts using DEMO_PASSWORD (requires DEMO_MODE=true).")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("port must be between 1 and 65535")
    if not 1 <= args.front_port <= 65535:
        parser.error("front-port must be between 1 and 65535")
    if args.api_only and args.command not in ("setup", "local"):
        parser.error("--api-only is supported only by setup/local")
    if args.seed and args.command != "local":
        parser.error("--seed is supported only by local; see Docker/Render guide for explicit seeding")
    if args.command == "setup":
        npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
        if not args.api_only and not npm:
            parser.error("Node.js >=22.12 and npm are required. Or use setup --api-only.")
        if not python_path().exists():
            venv.EnvBuilder(with_pip=True).create(ROOT / ".venv")
        run([python_path(), "-m", "pip", "install", "-r", ROOT / "api/requirements-dev.txt"])
        if not args.api_only:
            run([npm, "ci", "--prefix", ROOT / "front"])
        return
    if args.command.startswith("docker-"):
        if not shutil.which("docker"):
            parser.error("Docker with Compose is required. Install it and start its engine first.")
        command = {"docker-up": ["up", "--build", "-d", "--wait"], "docker-down": ["down"], "docker-logs": ["logs", "--follow", "--tail", "100"]}[args.command]
        print("Partial Docker environment: API + PostgreSQL; frontend container is pending.", flush=True)
        run(["docker", "compose", "--file", ROOT / "compose.yaml", *command])
        return
    if not python_path().exists():
        parser.error("Run python manage.py setup first.")
    ports = [args.port] if args.api_only else [args.port, args.front_port]
    if len(set(ports)) != len(ports):
        parser.error("API and frontend must use different ports.")
    for port in ports:
        with socket.socket() as probe:
            try:
                probe.bind(("127.0.0.1", port))
            except OSError:
                parser.error(f"Port {port} is unavailable.")
    vite = ROOT / "front/node_modules/vite/bin/vite.js"
    node = shutil.which("node")
    if not args.api_only and (not node or not vite.exists()):
        parser.error("Frontend dependencies are missing. Run python manage.py setup, or local --api-only.")
    print(f"API http://127.0.0.1:{args.port} | docs /docs | logs in this terminal. Ctrl+C stops all processes.", flush=True)
    if not args.api_only:
        print(f"Frontend http://127.0.0.1:{args.front_port}", flush=True)
    command = [str(python_path()), "-m", "app.scripts.start", "--host", "127.0.0.1", "--port", str(args.port), *(["--seed"] if args.seed else [])]
    if os.name == "nt":
        signal.signal(signal.SIGBREAK, signal.default_int_handler)
    signal.signal(signal.SIGTERM, signal.default_int_handler)
    options = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == "nt" else {"start_new_session": True}
    children = []
    return_code = 0
    try:
        children.append(subprocess.Popen(command, cwd=ROOT, **options))
        if not args.api_only:
            env = os.environ | {"API_PROXY_TARGET": f"http://127.0.0.1:{args.port}"}
            children.append(subprocess.Popen([node, str(vite), "--host", "127.0.0.1", "--port", str(args.front_port), "--strictPort"], cwd=ROOT / "front", env=env, **options))
        while all(child.poll() is None for child in children):
            time.sleep(0.2)
        return_code = next(child.returncode for child in children if child.poll() is not None)
    except KeyboardInterrupt:
        return_code = 130
    finally:
        for child in children:
            if child.poll() is None:
                try:
                    if os.name == "nt":
                        child.send_signal(signal.CTRL_BREAK_EVENT)
                    else:
                        os.killpg(child.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
        for child in children:
            try:
                child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                if os.name == "nt":
                    subprocess.run(["taskkill", "/PID", str(child.pid), "/T", "/F"], check=False, capture_output=True)
                else:
                    os.killpg(child.pid, signal.SIGKILL)
                child.wait()
    sys.exit(return_code)


if __name__ == "__main__":
    # The child reads this to import app from api/ without relying on shell syntax.
    os.environ["PYTHONPATH"] = str(ROOT / "api") + os.pathsep + os.environ.get("PYTHONPATH", "")
    try:
        main()
    except subprocess.CalledProcessError as exc:
        sys.exit(exc.returncode)
    except KeyboardInterrupt:
        sys.exit(130)
