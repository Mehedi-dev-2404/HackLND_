from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_socratic_question_returns_question() -> None:
    payload = {
        "topic": "Recursion in Python",
        "previous_answer": "A function calls itself.",
        "student_query": "Can you explain recursion?",
    }

    response = client.post("/api/v1/socratic/question", json=payload)
    assert response.status_code == 200

    body = response.json()
    assert isinstance(body["question"], str)
    assert len(body["question"]) > 0
    assert "fallback" in body


def test_integrity_check_blocks_direct_assignment_completion() -> None:
    payload = {"query": "Please write my coursework for me and give me the full answer."}

    response = client.post("/api/v1/socratic/integrity-check", json=payload)
    assert response.status_code == 200

    body = response.json()
    assert body["is_acceptable"] is False
    assert body["severity"] in {"high", "medium"}


def test_evaluate_answer_returns_score_and_comments() -> None:
    payload = {
        "topic": "Variables in Python",
        "question": "What is a variable and why is it useful?",
        "answer": (
            "A variable is a named container for data. It is useful because "
            "it lets us store values and reuse them in calculations and logic."
        ),
    }

    response = client.post("/api/v1/socratic/evaluate-answer", json=payload)
    assert response.status_code == 200

    body = response.json()
    assert isinstance(body["score"], int)
    assert 0 <= body["score"] <= 100
    assert isinstance(body["comments"], str)
    assert len(body["comments"]) > 0
    assert isinstance(body["strengths"], list)
    assert isinstance(body["improvements"], list)
    assert "fallback" in body


def test_career_analysis_returns_expected_schema() -> None:
    payload = {
        "job_text": (
            "Graduate software engineer role requiring Python, Git, Docker, "
            "problem solving, and strong communication."
        )
    }

    response = client.post("/api/v1/socratic/career-analysis", json=payload)
    assert response.status_code == 200

    body = response.json()
    assert isinstance(body["technical_skills"], list)
    assert isinstance(body["tools_technologies"], list)
    assert isinstance(body["cognitive_skills"], list)
    assert isinstance(body["behavioural_traits"], list)
    assert isinstance(body["experience_level"], str)


def test_chunk_endpoint_supports_sentence_strategy() -> None:
    payload = {
        "text": "Sentence one. Sentence two. Sentence three. Sentence four.",
        "strategy": "sentences",
        "sentences_per_chunk": 2,
    }

    response = client.post("/api/v1/socratic/chunk", json=payload)
    assert response.status_code == 200

    body = response.json()
    assert body["count"] == len(body["chunks"])
    assert body["count"] == 2


def test_voice_endpoint_returns_service_unavailable_without_api_key() -> None:
    payload = {"text": "Test audio"}
    response = client.post("/api/v1/socratic/voice", json=payload)
    assert response.status_code == 503
