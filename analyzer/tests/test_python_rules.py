import pytest

from tests.helpers import build_file, rule_ids
from app.engine import analyze_file

FIRES = [
    ("unused plain import", "import os\nx = 1", "unused-import"),
    ("unused from import", "from pathlib import Path\nx = 1", "unused-import"),
    ("unused aliased import", "import numpy as np\nx = 1", "unused-import"),
    ("bare except", "try:\n    x = 1\nexcept:\n    pass", "bare-except"),
    ("mutable list default", "def f(items=[]):\n    return items", "mutable-default"),
    ("mutable dict default", "def f(options={}):\n    return options", "mutable-default"),
    ("mutable list() default", "def f(items=list()):\n    return items", "mutable-default"),
    ("mutable keyword-only default", "def f(*, items=[]):\n    return items", "mutable-default"),
    ("mutable async default", "async def f(items=[]):\n    return items", "mutable-default"),
    ("print call", "print('debug')", "print-call"),
]

SILENT = [
    ("used import", "import os\nx = os.getcwd()", "unused-import"),
    ("dotted import used through its base", "import os.path\nx = os.path.join('a')", "unused-import"),
    ("from import used", "from pathlib import Path\nx = Path('.')", "unused-import"),
    ("future import", "from __future__ import annotations\nx = 1", "unused-import"),
    ("star import", "from os import *\nx = 1", "unused-import"),
    ("name listed in __all__", "from os import getcwd\n__all__ = ['getcwd']", "unused-import"),
    ("specific except", "try:\n    x = 1\nexcept ValueError:\n    pass", "bare-except"),
    ("except Exception", "try:\n    x = 1\nexcept Exception:\n    pass", "bare-except"),
    ("None default", "def f(items=None):\n    return items", "mutable-default"),
    ("tuple default", "def f(items=()):\n    return items", "mutable-default"),
    ("logger call", "import logging\nlogging.getLogger().info('x')", "print-call"),
    ("print method", "class A:\n    def go(self):\n        self.print('x')", "print-call"),
    ("print as a string", "x = 'print(1)'", "print-call"),
]


@pytest.mark.parametrize("name, code, expected", FIRES)
def test_rule_fires(name, code, expected):
    assert expected in rule_ids("app.py", code), name


@pytest.mark.parametrize("name, code, unexpected", SILENT)
def test_rule_stays_silent(name, code, unexpected):
    assert unexpected not in rule_ids("app.py", code), name


def test_unused_import_reports_the_import_line():
    file = build_file("app.py", "x = 1\nimport os\ny = 2")
    findings = analyze_file(file)
    assert [(f.line, f.rule_id) for f in findings] == [(2, "unused-import")]


def test_init_files_may_reexport_imports():
    assert rule_ids("pkg/__init__.py", "from .core import run") == []


def long_function(body_lines):
    body = "\n".join("    x = 1" for _ in range(body_lines))
    return f"def work():\n{body}"


def test_function_of_exactly_fifty_lines_is_fine():
    assert "long-function" not in rule_ids("app.py", long_function(49))


def test_function_of_fifty_one_lines_is_flagged():
    assert "long-function" in rule_ids("app.py", long_function(50))


def test_long_function_is_reported_on_the_def_line():
    findings = analyze_file(build_file("app.py", long_function(60)))
    assert [(f.line, f.rule_id) for f in findings] == [(1, "long-function")]


def test_files_with_syntax_errors_are_skipped():
    assert rule_ids("app.py", "def broken(:\n    print('x')") == []


def test_only_added_lines_are_reported():
    code = "import os\nx = 1\ntry:\n    x = 2\nexcept:\n    pass"
    assert rule_ids("app.py", code, added_lines=[2]) == []
    assert rule_ids("app.py", code, added_lines=[5]) == ["bare-except"]
