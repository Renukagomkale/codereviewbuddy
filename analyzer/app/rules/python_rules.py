import ast

from app.rules.base import Hit

MAX_FUNCTION_LINES = 50
MUTABLE_FACTORIES = {"list", "dict", "set"}
FUNCTION_NODES = (ast.FunctionDef, ast.AsyncFunctionDef)


def check(file):
    try:
        tree = ast.parse(file.content)
    except SyntaxError:
        return []
    hits = [
        *bare_excepts(tree),
        *mutable_defaults(tree),
        *print_calls(tree),
        *long_functions(tree),
    ]
    if not file.path.endswith("__init__.py"):
        hits.extend(unused_imports(tree))
    return hits


def unused_imports(tree):
    imported = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imported[alias.asname or alias.name.split(".")[0]] = node.lineno
        elif isinstance(node, ast.ImportFrom) and node.module != "__future__":
            for alias in node.names:
                if alias.name != "*":
                    imported[alias.asname or alias.name] = node.lineno
    used = {node.id for node in ast.walk(tree) if isinstance(node, ast.Name)}
    used |= exported_names(tree)
    return [
        Hit(line, "unused-import", "low", f"'{name}' is imported but never used.")
        for name, line in imported.items()
        if name not in used
    ]


def exported_names(tree):
    names = set()
    for node in ast.walk(tree):
        is_all = isinstance(node, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id == "__all__"
            for target in node.targets
        )
        if is_all and isinstance(node.value, (ast.List, ast.Tuple)):
            names.update(
                item.value
                for item in node.value.elts
                if isinstance(item, ast.Constant) and isinstance(item.value, str)
            )
    return names


def bare_excepts(tree):
    return [
        Hit(
            node.lineno,
            "bare-except",
            "medium",
            "Bare 'except:' also catches KeyboardInterrupt and SystemExit. Catch a specific exception instead.",
        )
        for node in ast.walk(tree)
        if isinstance(node, ast.ExceptHandler) and node.type is None
    ]


def is_mutable(node):
    if isinstance(node, (ast.List, ast.Dict, ast.Set)):
        return True
    return (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id in MUTABLE_FACTORIES
    )


def mutable_defaults(tree):
    hits = []
    for node in ast.walk(tree):
        if isinstance(node, (*FUNCTION_NODES, ast.Lambda)):
            defaults = [*node.args.defaults, *node.args.kw_defaults]
            for default in defaults:
                if default is not None and is_mutable(default):
                    hits.append(
                        Hit(
                            default.lineno,
                            "mutable-default",
                            "high",
                            "Mutable default argument is shared between calls. Use None and create the value inside the function.",
                        )
                    )
    return hits


def print_calls(tree):
    return [
        Hit(node.lineno, "print-call", "low", "Leftover print call. Remove it or use logging.")
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "print"
    ]


def long_functions(tree):
    hits = []
    for node in ast.walk(tree):
        if isinstance(node, FUNCTION_NODES):
            length = node.end_lineno - node.lineno + 1
            if length > MAX_FUNCTION_LINES:
                hits.append(
                    Hit(
                        node.lineno,
                        "long-function",
                        "medium",
                        f"Function '{node.name}' is {length} lines long. Consider splitting it into smaller functions.",
                    )
                )
    return hits
