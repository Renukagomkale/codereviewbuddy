from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AddedLine(BaseModel):
    line: int = Field(ge=1)
    text: str


class FileInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    path: str
    language: str | None = None
    added_lines: list[AddedLine] = Field(alias="addedLines")
    content: str


class AnalyzeRequest(BaseModel):
    files: list[FileInput] = Field(max_length=200)


class Finding(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    path: str
    line: int
    rule_id: str = Field(alias="ruleId")
    severity: Literal["low", "medium", "high"]
    message: str


class AnalyzeResponse(BaseModel):
    findings: list[Finding]
