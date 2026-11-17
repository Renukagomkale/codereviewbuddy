from app.engine import analyze_file
from app.schemas import AddedLine, FileInput


def build_file(path, content, added_lines=None, language=None):
    lines = content.split("\n")
    numbers = added_lines if added_lines is not None else range(1, len(lines) + 1)
    return FileInput(
        path=path,
        language=language,
        content=content,
        added_lines=[AddedLine(line=number, text=lines[number - 1]) for number in numbers],
    )


def rule_ids(path, content, added_lines=None, language=None):
    file = build_file(path, content, added_lines, language)
    return [finding.rule_id for finding in analyze_file(file)]
