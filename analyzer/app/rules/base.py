from typing import NamedTuple


class Hit(NamedTuple):
    line: int
    rule_id: str
    severity: str
    message: str
