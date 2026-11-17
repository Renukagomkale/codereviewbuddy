import pytest

from app.engine import analyze_file
from app.rules.catalog import RULES
from tests.helpers import build_file

LONG_FUNCTION = "def work():\n" + "\n".join("    x = 1" for _ in range(60))

SAMPLES = {
    "unused-import": ("a.py", "import os\nx = 1"),
    "bare-except": ("a.py", "try:\n    x = 1\nexcept:\n    pass"),
    "mutable-default": ("a.py", "def f(items=[]):\n    return items"),
    "print-call": ("a.py", "print(1)"),
    "long-function": ("a.py", LONG_FUNCTION),
    "console-log": ("a.js", "console.log(1);"),
    "var-declaration": ("a.js", "var a = 1;"),
    "loose-equality": ("a.js", "if (a == b) {}"),
    "empty-catch": ("a.js", "try { run(); } catch (e) {}"),
    "hardcoded-secret": ("a.txt", 'password = "hunter2hunter2"'),
    "todo-comment": ("a.txt", "# TODO: fix this"),
}


def test_every_rule_has_a_unique_id():
    ids = [rule["id"] for rule in RULES]
    assert len(ids) == len(set(ids))


def test_catalog_and_samples_describe_the_same_rules():
    assert set(SAMPLES) == {rule["id"] for rule in RULES}


@pytest.mark.parametrize("rule", RULES, ids=lambda rule: rule["id"])
def test_rule_fires_with_the_severity_the_catalog_promises(rule):
    path, code = SAMPLES[rule["id"]]
    findings = analyze_file(build_file(path, code))
    matching = [finding for finding in findings if finding.rule_id == rule["id"]]
    assert matching, rule["id"]
    assert matching[0].severity == rule["severity"]


@pytest.mark.parametrize("rule", RULES, ids=lambda rule: rule["id"])
def test_rule_entry_has_every_field(rule):
    assert set(rule) == {"id", "title", "language", "severity", "description"}
    assert rule["language"] in {"python", "javascript", "any"}
    assert rule["severity"] in {"low", "medium", "high"}
