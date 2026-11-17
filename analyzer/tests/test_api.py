from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def payload(path="a.py", content="print(1)", language="python"):
    return {
        "files": [
            {
                "path": path,
                "language": language,
                "addedLines": [{"line": 1, "text": content}],
                "content": content,
            }
        ]
    }


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_analyze_returns_findings_in_the_agreed_contract():
    response = client.post("/analyze", json=payload())
    assert response.status_code == 200
    findings = response.json()["findings"]
    assert len(findings) == 1
    assert set(findings[0]) == {"path", "line", "ruleId", "severity", "message"}
    assert findings[0]["ruleId"] == "print-call"
    assert findings[0]["path"] == "a.py"
    assert findings[0]["line"] == 1


def test_analyze_returns_an_empty_list_for_clean_code():
    response = client.post("/analyze", json=payload(content="x = 1"))
    assert response.json() == {"findings": []}


def test_analyze_accepts_files_without_a_language():
    response = client.post("/analyze", json=payload(language=None))
    assert response.json()["findings"][0]["ruleId"] == "print-call"


def test_analyze_rejects_a_malformed_body():
    response = client.post("/analyze", json={"files": [{"path": "a.py"}]})
    assert response.status_code == 422


def test_analyze_rejects_too_many_files():
    body = {"files": payload()["files"] * 201}
    assert client.post("/analyze", json=body).status_code == 422


def test_rules_endpoint_lists_the_catalog():
    from app.rules.catalog import RULES

    response = client.get("/rules")
    assert response.status_code == 200
    assert response.json() == {"rules": RULES}
