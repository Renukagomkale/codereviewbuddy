import re

from app.rules.base import Hit

STRING_LITERAL = re.compile(r"""(["'`])(?:\\.|(?!\1).)*\1""")
LINE_COMMENT = re.compile(r"//.*$")
CONSOLE_LOG = re.compile(r"\bconsole\.log\s*\(")
VAR_DECLARATION = re.compile(r"^\s*(?:export\s+)?var\s+[A-Za-z_$]")
LOOSE_EQUALITY = re.compile(r"(?<![=!<>])==(?!=)|!=(?!=)")
NULL_COMPARISON = re.compile(r"[=!]=\s*null\b|\bnull\s*[=!]=")
EMPTY_CATCH = re.compile(r"\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}")


def strip_noise(text):
    return LINE_COMMENT.sub("", STRING_LITERAL.sub('""', text))


def check(file):
    hits = []
    for added in file.added_lines:
        code = strip_noise(added.text)
        if CONSOLE_LOG.search(code):
            hits.append(Hit(added.line, "console-log", "low", "Leftover console.log. Remove it or use a proper logger."))
        if VAR_DECLARATION.match(code):
            hits.append(Hit(added.line, "var-declaration", "medium", "Use let or const instead of var."))
        if LOOSE_EQUALITY.search(code) and not NULL_COMPARISON.search(code):
            hits.append(Hit(added.line, "loose-equality", "medium", "Use === or !== to avoid unexpected type coercion."))
    hits.extend(empty_catches(file.content))
    return hits


def empty_catches(content):
    return [
        Hit(
            content.count("\n", 0, match.start()) + 1,
            "empty-catch",
            "medium",
            "Empty catch block swallows errors silently. Handle or log the error.",
        )
        for match in EMPTY_CATCH.finditer(content)
    ]
