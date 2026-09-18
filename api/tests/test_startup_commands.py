import os
from pathlib import Path
import signal
import shutil
import socket
import subprocess
import sys
import time
import urllib.request

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import ROOT, get_settings
from app.db.models import Company, User
from app.db.session import build_engine
from app.scripts.seed_demo import main as seed_demo
from app.scripts.start import prepare_database


def test_prepare_database_and_idempotent_seed(tmp_path, monkeypatch):
    url = f"sqlite:///{(tmp_path / 'demo.db').as_posix()}"
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DEMO_MODE", "true")
    monkeypatch.setenv("DEMO_PASSWORD", "test-demo-password")
    get_settings.cache_clear()
    try:
        prepare_database(seed=True)
        engine = build_engine(url)
        with Session(engine) as db:
            hashes = list(db.scalars(select(User.password_hash).order_by(User.email)))
        monkeypatch.setenv("DEMO_PASSWORD", "different-demo-password")
        seed_demo()
        with Session(engine) as db:
            assert db.scalar(select(func.count()).select_from(Company)) == 2
            assert db.scalar(select(func.count()).select_from(User)) == 2
            assert list(db.scalars(select(User.password_hash).order_by(User.email))) == hashes
        engine.dispose()
        monkeypatch.setenv("DEMO_MODE", "false")
        get_settings.cache_clear()
        with pytest.raises(RuntimeError, match="DEMO_MODE"):
            seed_demo()
    finally:
        get_settings.cache_clear()


@pytest.mark.parametrize("with_frontend", [False, True])
def test_local_command_starts_and_stops(tmp_path, with_frontend):
    if with_frontend and (not shutil.which("node") or not (ROOT / "front/node_modules/vite/bin/vite.js").exists()):
        pytest.skip("Frontend dependencies are required for the integrated launcher test")
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        front_port = probe.getsockname()[1]
    env = os.environ | {"DATABASE_URL": f"sqlite:///{(tmp_path / 'local.db').as_posix()}", "APP_ENV": "test"}
    log_path = tmp_path / "local.log"
    options = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == "nt" else {"start_new_session": True}
    with log_path.open("w") as log:
        front_args = ["--front-port", str(front_port)] if with_frontend else ["--api-only"]
        process = subprocess.Popen([sys.executable, str(ROOT / "manage.py"), "local", *front_args, "--port", str(port)], cwd=tmp_path, env=env, stdout=log, stderr=log, **options)
        try:
            deadline = time.monotonic() + 20
            while time.monotonic() < deadline:
                if process.poll() is not None:
                    pytest.fail(log_path.read_text())
                try:
                    with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=1) as response:
                        assert response.status == 200
                    if with_frontend:
                        with urllib.request.urlopen(f"http://127.0.0.1:{front_port}/api/health", timeout=1) as response:
                            assert response.status == 200
                        with urllib.request.urlopen(f"http://127.0.0.1:{front_port}/empresa", timeout=1) as response:
                            assert b'<div id="root">' in response.read()
                    break
                except OSError:
                    time.sleep(0.1)
            else:
                pytest.fail("API did not start: " + log_path.read_text())
        finally:
            if process.poll() is None:
                process.send_signal(signal.CTRL_BREAK_EVENT if os.name == "nt" else signal.SIGINT)
                process.wait(timeout=15)
    # No API remains listening after the launcher exits.
    with socket.socket() as probe:
        assert probe.connect_ex(("127.0.0.1", port)) != 0
    if with_frontend:
        with socket.socket() as probe:
            assert probe.connect_ex(("127.0.0.1", front_port)) != 0


def test_local_command_rejects_busy_port():
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen()
        result = subprocess.run([sys.executable, str(ROOT / "manage.py"), "local", "--port", str(listener.getsockname()[1])], capture_output=True, text=True)
        assert result.returncode != 0
        assert "unavailable" in result.stderr
