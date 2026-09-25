import importlib.util
from io import BytesIO

import pytest

from app.core.config import ROOT

spec = importlib.util.spec_from_file_location("deploy_render", ROOT / "scripts/deploy_render.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def config():
    return {"RENDER_API_KEY": "test-token", "RENDER_SERVICE_ID": "srv-test", "DEPLOY_COMMIT": "a" * 40, "RENDER_HEALTH_URL": "https://example.com/health"}


def test_deploy_uses_tested_commit_and_checks_health(monkeypatch):
    calls = []
    def request(url, token, payload=None):
        calls.append((url, token, payload))
        return {"id": "dep-test"} if payload else {"status": "live", "commit": {"id": "a" * 40}}
    class Response(BytesIO):
        status = 200
    def health(url, timeout):
        assert url == "https://example.com/health"
        return Response(b'{"status":"ok"}')
    monkeypatch.setattr(module.urllib.request, "urlopen", health)
    module.deploy(config(), request=request, sleep=lambda _: None)
    assert calls[0][2] == {"commitId": "a" * 40}
    assert calls[1][0].endswith("/dep-test")


@pytest.mark.parametrize("status", ["build_failed", "pre_deploy_failed", "update_failed", "canceled", "deactivated"])
def test_failed_deploy_does_not_pass(status):
    def request(url, token, payload=None):
        return {"id": "dep-test"} if payload else {"status": status}
    with pytest.raises(RuntimeError, match="failed"):
        module.deploy(config(), request=request, sleep=lambda _: None)


def test_different_commit_rejected():
    def request(url, token, payload=None):
        return {"id": "dep-test"} if payload else {"status": "live", "commit": {"id": "b" * 40}}
    with pytest.raises(RuntimeError, match="different commit"):
        module.deploy(config(), request=request, sleep=lambda _: None)
