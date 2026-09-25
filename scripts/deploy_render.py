"""Deploy the exact CI-tested commit, wait for Render, then check HTTP health."""

import json
import os
import re
import time
import urllib.error
import urllib.request


def request_json(url, token, payload=None):
    request = urllib.request.Request(url, data=json.dumps(payload).encode() if payload is not None else None,
                                     headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def deploy(environ=os.environ, request=request_json, sleep=time.sleep):
    token = environ["RENDER_API_KEY"]
    service = environ["RENDER_SERVICE_ID"]
    commit = environ["DEPLOY_COMMIT"]
    health = environ["RENDER_HEALTH_URL"]
    if not token or not re.fullmatch(r"srv-[a-zA-Z0-9]+", service) or not re.fullmatch(r"[0-9a-f]{40}", commit) or not health.startswith("https://"):
        raise ValueError("Invalid deployment configuration.")
    base = f"https://api.render.com/v1/services/{service}/deploys"
    result = request(base, token, {"commitId": commit})
    deploy_id = result["id"]
    for _ in range(120):
        result = request(f"{base}/{deploy_id}", token)
        status = result["status"]
        if status == "live":
            if result.get("commit", {}).get("id") != commit:
                raise RuntimeError("Render deployed a different commit.")
            break
        if status in {"build_failed", "update_failed", "pre_deploy_failed", "canceled", "deactivated"}:
            raise RuntimeError(f"Render deploy failed: {status}")
        sleep(10)
    else:
        raise RuntimeError("Render deploy timeout; inspect its status before retrying.")
    # No Render credentials sent to the application's health endpoint.
    for attempt in range(6):
        try:
            with urllib.request.urlopen(health, timeout=10) as response:
                if response.status == 200 and json.load(response).get("status") == "ok":
                    print(f"Deployment healthy for commit {commit}.")
                    return
        except (OSError, ValueError):
            pass
        if attempt < 5:
            sleep(5)
    raise RuntimeError("Post-deploy health check failed.")


if __name__ == "__main__":
    try:
        deploy()
    except (KeyError, ValueError, RuntimeError, urllib.error.URLError) as exc:
        # Do not dump headers, tokens or response bodies.
        raise SystemExit(f"Deployment failed ({type(exc).__name__}); inspect the Render dashboard.") from None
