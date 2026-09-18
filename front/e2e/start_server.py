"""Prepare the isolated E2E database and start the real local application."""

import os
import runpy
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[2]
python = root / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
if os.environ.get("APP_ENV") != "test" or not os.environ.get("DATABASE_URL"):
    raise SystemExit("E2E startup requires APP_ENV=test and an explicit disposable DATABASE_URL.")
env = os.environ | {"PYTHONPATH": str(root / "api")}
subprocess.run([str(python), "-m", "alembic", "-c", str(root / "api/alembic.ini"), "upgrade", "head"], cwd=root, env=env, check=True)
subprocess.run([str(python), "-m", "app.scripts.units_catalog", "seed"], cwd=root, env=env, check=True)
# Keep the launcher in this process: execv on Windows can orphan its process tree.
sys.argv = [str(root / "manage.py"), "local", "--port", "8019", "--front-port", "5179"]
runpy.run_path(str(root / "manage.py"), run_name="__main__")
