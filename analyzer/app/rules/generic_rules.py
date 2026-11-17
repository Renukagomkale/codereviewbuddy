import re

from app.rules.base import Hit

SECRET_PATTERNS = [
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36,}\b"),
    re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----"),
]
ASSIGNED_SECRET = re.compile(
    r"""(?i)\b\w*(?:api[_-]?key|secret|passw(?:or)?d|token)\w*\s*[:=]\s*["']([^"'\s]{8,})["']"""
)
PLACEHOLDER = re.compile(r"(?i)example|placeholder|changeme|your[_-]|x{4,}|<.*>")
TODO_COMMENT = re.compile(r"(?:#|//|/\*|\*|<!--)\s*(TODO|FIXME)\b")

SECRET_MESSAGE = "Possible hardcoded secret. Move it to an environment variable and rotate it if it was ever committed."


def check(file):
    hits = []
    for added in file.added_lines:
        if contains_secret(added.text):
            hits.append(Hit(added.line, "hardcoded-secret", "high", SECRET_MESSAGE))
        todo = TODO_COMMENT.search(added.text)
        if todo:
            hits.append(
                Hit(
                    added.line,
                    "todo-comment",
                    "low",
                    f"Leftover {todo.group(1)} comment. Resolve it or track it as an issue.",
                )
            )
    return hits


def contains_secret(text):
    if any(pattern.search(text) for pattern in SECRET_PATTERNS):
        return True
    assigned = ASSIGNED_SECRET.search(text)
    return bool(assigned) and not PLACEHOLDER.search(assigned.group(1))
