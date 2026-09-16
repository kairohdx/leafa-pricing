"""Remove structured credential fields from audit payloads."""
import re

SENSITIVE_KEYS = {"password", "passwordhash", "currentpassword", "newpassword", "token", "tokenhash",
                  "accesstoken", "refreshtoken", "authorization", "secret", "clientsecret", "apikey"}


def redact(value):
    if isinstance(value, dict):
        return {key: "[REDACTED]" if re.sub(r"[^a-z0-9]", "", key.lower()) in SENSITIVE_KEYS else redact(item)
                for key, item in value.items()}
    if isinstance(value, list):
        return [redact(item) for item in value]
    return value
