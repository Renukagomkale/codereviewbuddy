from app.engine import analyze, analyze_file, resolve_language
from tests.helpers import build_file


def test_findings_are_sorted_by_line():
    content = "print(1)\nimport os\ntry:\n    pass\nexcept:\n    pass"
    lines = [finding.line for finding in analyze_file(build_file("a.py", content))]
    assert lines == sorted(lines)


def test_same_rule_on_same_line_is_reported_once():
    findings = analyze_file(build_file("a.py", "print(1); print(2)"))
    assert [finding.rule_id for finding in findings] == ["print-call"]


def test_different_rules_on_the_same_line_are_both_reported():
    findings = analyze_file(build_file("a.js", "var a = 1; console.log(a);"))
    assert {finding.rule_id for finding in findings} == {"var-declaration", "console-log"}


def test_explicit_language_overrides_the_extension():
    assert resolve_language(build_file("script", "x", language="Python")) == "python"


def test_language_falls_back_to_the_extension():
    assert resolve_language(build_file("src/app.TSX", "x")) == "javascript"


def test_unknown_extension_has_no_language():
    assert resolve_language(build_file("README.md", "x")) is None


def test_findings_carry_the_file_path():
    findings = analyze([build_file("a.py", "print(1)"), build_file("b.py", "print(2)")])
    assert [finding.path for finding in findings] == ["a.py", "b.py"]


def test_no_added_lines_means_no_findings():
    assert analyze_file(build_file("a.py", "print(1)", added_lines=[])) == []
