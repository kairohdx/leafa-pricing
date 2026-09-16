"""Cross-platform entry point. Run `python manage.py --help` from any directory."""

import argparse
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import venv

ROOT = Path(__file__).resolve().parent


def python_path():
    return ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def run(command):
    return subprocess.run([str(arg) for arg in command], cwd=ROOT, check=True)


def main():
    parser = argparse.ArgumentParser(description="Leafa: setup, local API/SQLite and Docker API/PostgreSQL.")
    parser.add_argument("command", choices=["setup", "local", "docker-up", "docker-down", "docker-logs"])
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--seed", action="store_true", help="Create demo accounts using DEMO_PASSWORD (requires DEMO_MODE=true).")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("port must be between 1 and 65535")
    if args.seed and args.command != "local":
        parser.error("--seed is supported only by local; see Docker/Render guide for explicit seeding")
    if args.command == "setup":
        if not python_path().exists():
            venv.EnvBuilder(with_pip=True).create(ROOT / ".venv")
        run([python_path(), "-m", "pip", "install", "-r", ROOT / "api/requirements-dev.txt"])
        return
    if args.command.startswith("docker-"):
        if not shutil.which("docker"):
            parser.error("Docker with Compose is required. Install it and start its engine first.")
        command = {"docker-up": ["up", "--build", "-d", "--wait"], "docker-down": ["down"], "docker-logs": ["logs", "--follow", "--tail", "100"]}[args.command]
        print("Partial environment: API + PostgreSQL; frontend is not implemented.", flush=True)
        run(["docker", "compose", "--file", ROOT / "compose.yaml", *command])
        return
    if not python_path().exists():
        parser.error("Run python manage.py setup first.")
    with socket.socket() as probe:
        try:
            probe.bind(("127.0.0.1", args.port))
        except OSError:
            parser.error(f"Port {args.port} is unavailable.")
    print("Partial environment: database + API; frontend is not implemented.", flush=True)
    print(f"API http://127.0.0.1:{args.port} | docs /docs | logs in this terminal. Ctrl+C stops the API.", flush=True)
    # Replace the launcher: a single server owns the terminal and receives signals.
    os.chdir(ROOT)
    command = [str(python_path()), "-m", "app.scripts.start", "--host", "127.0.0.1", "--port", str(args.port), *(["--seed"] if args.seed else [])]
    if os.name != "nt":
        os.execv(str(python_path()), command)
    signal.signal(signal.SIGBREAK, signal.default_int_handler)
    child = subprocess.Popen(command, creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
    try:
        while True:
            try:
                return_code = child.wait(timeout=0.2)
                break
            except subprocess.TimeoutExpired:
                continue
    except KeyboardInterrupt:
        child.send_signal(signal.CTRL_BREAK_EVENT)
        try:
            child.wait(timeout=10)
        except subprocess.TimeoutExpired:
            child.terminate()
            child.wait()
        return_code = 130
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
