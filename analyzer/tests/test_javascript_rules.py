import pytest

from tests.helpers import build_file, rule_ids
from app.engine import analyze_file

FIRES = [
    ("console.log", "console.log('debug');", "console-log"),
    ("console.log with spacing", "  console.log  ('debug');", "console-log"),
    ("var declaration", "var count = 0;", "var-declaration"),
    ("exported var", "export var count = 0;", "var-declaration"),
    ("loose equality", "if (a == b) {", "loose-equality"),
    ("loose inequality", "if (a != b) {", "loose-equality"),
    ("loose equality with number", "if (count == 0) {", "loose-equality"),
    ("empty catch with param", "try { run(); } catch (e) {}", "empty-catch"),
    ("empty catch without param", "try { run(); } catch {}", "empty-catch"),
    ("empty catch over two lines", "try {\n  run();\n} catch (e) {\n}", "empty-catch"),
]

SILENT = [
    ("console.error", "console.error('failed');", "console-log"),
    ("console.log in a comment", "// console.log('debug');", "console-log"),
    ("console.log inside a string", "const s = \"console.log(1)\";", "console-log"),
    ("const", "const count = 0;", "var-declaration"),
    ("variable named like var", "const variable = 1;", "var-declaration"),
    ("var inside a string", "const s = 'var x = 1';", "var-declaration"),
    ("strict equality", "if (a === b) {", "loose-equality"),
    ("strict inequality", "if (a !== b) {", "loose-equality"),
    ("null check idiom", "if (value == null) {", "loose-equality"),
    ("greater or equal", "if (a >= b) {", "loose-equality"),
    ("less or equal", "if (a <= b) {", "loose-equality"),
    ("arrow function", "const f = (a) => a;", "loose-equality"),
    ("equality inside a string", "const s = 'a == b';", "loose-equality"),
    ("catch with a body", "try { run(); } catch (e) { report(e); }", "empty-catch"),
    ("catch with a comment only", "try { run(); } catch (e) { /* ignore */ }", "empty-catch"),
]


@pytest.mark.parametrize("name, code, expected", FIRES)
def test_rule_fires(name, code, expected):
    assert expected in rule_ids("src/app.js", code), name


@pytest.mark.parametrize("name, code, unexpected", SILENT)
def test_rule_stays_silent(name, code, unexpected):
    assert unexpected not in rule_ids("src/app.js", code), name


@pytest.mark.parametrize("path", ["a.js", "a.jsx", "a.ts", "a.tsx", "a.mjs", "a.cjs"])
def test_javascript_and_typescript_extensions_are_covered(path):
    assert "console-log" in rule_ids(path, "console.log(1);")


def test_typescript_language_name_maps_to_javascript_rules():
    assert "console-log" in rule_ids("file.txt", "console.log(1);", language="typescript")


def test_empty_catch_is_reported_on_the_catch_line():
    content = "try {\n  run();\n} catch (e) {\n}"
    findings = analyze_file(build_file("a.js", content))
    assert [(f.line, f.rule_id) for f in findings] == [(3, "empty-catch")]


def test_empty_catch_is_ignored_when_its_line_was_not_added():
    content = "try {\n  run();\n} catch (e) {\n}\nconst x = 1;"
    assert rule_ids("a.js", content, added_lines=[5]) == []
