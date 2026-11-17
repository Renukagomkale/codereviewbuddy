from fastapi import FastAPI

from app.engine import analyze
from app.rules.catalog import RULES
from app.schemas import AnalyzeRequest, AnalyzeResponse

app = FastAPI(title="CodeReviewBuddy Analyzer")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze_files(request: AnalyzeRequest):
    return AnalyzeResponse(findings=analyze(request.files))


@app.get("/rules")
def list_rules():
    return {"rules": RULES}
