from pathlib import PurePosixPath

from app.rules import generic_rules, javascript_rules, python_rules
from app.schemas import Finding

LANGUAGE_BY_EXTENSION = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".ts": "javascript",
    ".tsx": "javascript",
}
LANGUAGE_ALIASES = {"typescript": "javascript"}
CHECKS_BY_LANGUAGE = {
    "python": [python_rules.check],
    "javascript": [javascript_rules.check],
}
GENERIC_CHECKS = [generic_rules.check]


def resolve_language(file):
    if file.language:
        language = file.language.lower()
        return LANGUAGE_ALIASES.get(language, language)
    return LANGUAGE_BY_EXTENSION.get(PurePosixPath(file.path).suffix.lower())


def analyze_file(file):
    checks = [*CHECKS_BY_LANGUAGE.get(resolve_language(file), []), *GENERIC_CHECKS]
    added = {added_line.line for added_line in file.added_lines}
    seen = set()
    findings = []
    for check in checks:
        for hit in check(file):
            key = (hit.line, hit.rule_id)
            if hit.line not in added or key in seen:
                continue
            seen.add(key)
            findings.append(
                Finding(
                    path=file.path,
                    line=hit.line,
                    rule_id=hit.rule_id,
                    severity=hit.severity,
                    message=hit.message,
                )
            )
    return sorted(findings, key=lambda finding: finding.line)


def analyze(files):
    return [finding for file in files for finding in analyze_file(file)]
