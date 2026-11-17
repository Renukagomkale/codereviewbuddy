import pytest

from tests.helpers import build_file, rule_ids
from app.engine import analyze_file

AWS_KEY = "AKIA" + "ABCDEFGHIJKLMNOP"
GITHUB_TOKEN = "ghp_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8"

SECRET_LINES = [
    ("aws access key", f'aws_key = "{AWS_KEY}"'),
    ("github token", f"token: {GITHUB_TOKEN}"),
    ("private key header", "-----BEGIN RSA PRIVATE KEY-----"),
    ("openssh private key header", "-----BEGIN OPENSSH PRIVATE KEY-----"),
    ("assigned password", 'password = "hunter2hunter2"'),
    ("assigned api key", "const apiKey = 'k9f8d7s6a5d4f3';"),
    ("assigned secret with colon", 'secret: "s3cr3t-value-123"'),
]

NOT_SECRET_LINES = [
    ("placeholder example", 'api_key = "example-api-key-value"'),
    ("placeholder your", 'secret = "your_secret_here"'),
    ("changeme", 'password = "changeme123"'),
    ("short value", 'password = "abc"'),
    ("environment lookup", 'password = os.environ["DB_PASSWORD"]'),
    ("ordinary string", 'title = "Hello world, this is fine"'),
    ("wrong length aws style", 'x = "AKIA123"'),
]


@pytest.mark.parametrize("name, line", SECRET_LINES)
def test_secrets_are_flagged(name, line):
    assert "hardcoded-secret" in rule_ids("config.txt", line), name


@pytest.mark.parametrize("name, line", NOT_SECRET_LINES)
def test_non_secrets_are_ignored(name, line):
    assert "hardcoded-secret" not in rule_ids("config.txt", line), name


def test_secret_finding_is_high_severity_and_never_echoes_the_secret():
    finding = analyze_file(build_file("config.txt", f'key = "{AWS_KEY}"'))[0]
    assert finding.severity == "high"
    assert AWS_KEY not in finding.message


TODO_FIRES = [
    "# TODO: fix this",
    "// FIXME later",
    "/* TODO handle errors */",
    "<!-- TODO remove -->",
    " * FIXME broken",
]
TODO_SILENT = [
    "todo_list = []",
    "const FIXMEs = 1;",
    "x = 'TODO'",
    "# done",
]


@pytest.mark.parametrize("line", TODO_FIRES)
def test_todo_comments_are_flagged(line):
    assert "todo-comment" in rule_ids("notes.txt", line)


@pytest.mark.parametrize("line", TODO_SILENT)
def test_non_todo_lines_are_ignored(line):
    assert "todo-comment" not in rule_ids("notes.txt", line)


def test_todo_message_names_the_keyword():
    finding = analyze_file(build_file("notes.txt", "# FIXME broken"))[0]
    assert "FIXME" in finding.message


def test_unknown_languages_only_get_generic_rules():
    ids = rule_ids("main.go", 'console.log(1)\nvar x = 1\npassword = "hunter2hunter2"')
    assert ids == ["hardcoded-secret"]


def test_generic_rules_also_apply_to_python_and_javascript():
    assert "hardcoded-secret" in rule_ids("a.py", f'KEY = "{AWS_KEY}"')
    assert "hardcoded-secret" in rule_ids("a.js", f'const key = "{AWS_KEY}";')
