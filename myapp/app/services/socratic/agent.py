import json
import re
from pathlib import Path
from typing import Any

from google import genai

from app.services.socratic.chunker import (
    chunk_by_paragraphs,
    chunk_by_sentences,
    chunk_text,
)


class SocraticAgentService:
    _RED_FLAG_PATTERNS = [
        r"\b(write|complete|do|solve) (my|this|the) (assignment|essay|coursework|homework)\b",
        r"\b(give|provide|show) (me )?(the )?(answer|solution|code)\b",
        r"\bwrite.*for me\b",
        r"\bcomplete.*assignment\b",
        r"\bgive.*full (code|essay|solution)\b",
    ]

    _TECHNICAL_SKILLS = [
        "python",
        "java",
        "javascript",
        "typescript",
        "sql",
        "mongodb",
        "postgresql",
        "machine learning",
        "data analysis",
        "rest api",
        "fastapi",
        "react",
    ]
    _TOOLS = [
        "git",
        "docker",
        "kubernetes",
        "aws",
        "azure",
        "gcp",
        "linux",
        "jira",
        "figma",
        "power bi",
    ]
    _COGNITIVE = [
        "problem solving",
        "analytical thinking",
        "critical thinking",
        "attention to detail",
        "debugging",
        "reasoning",
    ]
    _BEHAVIOURAL = [
        "communication",
        "teamwork",
        "collaboration",
        "leadership",
        "adaptability",
        "stakeholder management",
    ]
    _ANSWER_STOPWORDS = {
        "the",
        "and",
        "for",
        "that",
        "with",
        "this",
        "from",
        "into",
        "your",
        "about",
        "what",
        "when",
        "where",
        "which",
        "have",
        "will",
        "would",
        "could",
        "should",
        "their",
        "there",
        "than",
        "then",
        "they",
        "them",
        "because",
        "while",
        "been",
        "being",
        "does",
        "did",
        "how",
        "why",
    }

    def __init__(
        self,
        model: str,
        api_key: str = "",
        enable_live: bool = False,
        prompt_dir: Path | None = None,
    ) -> None:
        self.model = model
        self.api_key = api_key
        self.enable_live = bool(enable_live and api_key.strip())
        self.client = genai.Client(api_key=api_key) if self.enable_live else None
        self.prompt_dir = prompt_dir or (Path(__file__).resolve().parent / "prompts")

    def _load_prompt(self, name: str) -> str:
        path = self.prompt_dir / name
        return path.read_text(encoding="utf-8")

    def _extract_response_text(self, response: Any) -> str:
        text = getattr(response, "text", None)
        if isinstance(text, str) and text.strip():
            return text.strip()

        candidates = getattr(response, "candidates", None) or []
        for candidate in candidates:
            content = getattr(candidate, "content", None)
            parts = getattr(content, "parts", None) or []
            for part in parts:
                value = getattr(part, "text", None)
                if isinstance(value, str) and value.strip():
                    return value.strip()
        raise ValueError("Gemini response did not contain text output")

    def _generate_text(self, prompt: str, temperature: float) -> str:
        if self.client is None:
            raise ValueError("Live Gemini is disabled")

        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config={"temperature": float(temperature)},
        )
        return self._extract_response_text(response)

    def _matches_red_flag(self, query: str) -> bool:
        for pattern in self._RED_FLAG_PATTERNS:
            if re.search(pattern, query, re.IGNORECASE):
                return True
        return False

    def _ai_integrity_assessment(self, query: str) -> dict:
        prompt = f"""You are an academic integrity officer at a UK Russell Group university.

Assess if this student query violates academic integrity policies.

Query: "{query}"

Determine:
1. Is the student asking for direct assignment completion?
2. Or are they seeking legitimate learning support?

Legitimate: concept explanations, debugging guidance, methodology questions.
Violation: requests for complete solutions, essay writing, direct answers.

Respond with ONLY one label:
ACCEPTABLE
VIOLATION
"""
        result = self._generate_text(prompt=prompt, temperature=0.1).strip().upper()
        if "VIOLATION" in result:
            return {
                "is_acceptable": False,
                "reason": "AI detected potential academic integrity violation",
                "severity": "medium",
            }
        return {
            "is_acceptable": True,
            "reason": "Query is a legitimate learning request",
            "severity": "none",
        }

    def check_academic_integrity(self, student_query: str) -> dict:
        if self._matches_red_flag(student_query):
            return {
                "is_acceptable": False,
                "reason": "Request appears to seek direct assignment completion",
                "severity": "high",
            }

        if not self.enable_live:
            return {
                "is_acceptable": True,
                "reason": "Heuristic check passed (live integrity model disabled)",
                "severity": "none",
            }

        try:
            return self._ai_integrity_assessment(student_query)
        except Exception:
            return {
                "is_acceptable": True,
                "reason": "Could not assess - defaulting to acceptable",
                "severity": "unknown",
            }

    def _fallback_socratic_question(self, topic: str, previous_answer: str | None) -> str:
        if previous_answer and previous_answer.strip():
            clipped = previous_answer.strip().splitlines()[0][:120]
            return (
                f"You said: '{clipped}'. Which assumption in that answer matters most "
                f"for {topic}, and how could you test it with evidence?"
            )
        return (
            f"For {topic}, what core principle must be true before any solution works, "
            "and why?"
        )

    def _clamp_score(self, value: Any) -> int:
        try:
            parsed = int(round(float(value)))
        except Exception:
            parsed = 0
        return max(0, min(100, parsed))

    def _tokenize_keywords(self, text: str) -> set[str]:
        words = re.findall(r"[A-Za-z0-9_]+", text.lower())
        return {
            word
            for word in words
            if len(word) > 2 and word not in self._ANSWER_STOPWORDS
        }

    def _heuristic_answer_evaluation(self, topic: str, question: str, answer: str) -> dict:
        answer_clean = answer.strip()
        answer_words = re.findall(r"\b\w+\b", answer_clean)
        word_count = len(answer_words)

        answer_tokens = self._tokenize_keywords(answer_clean)
        target_tokens = self._tokenize_keywords(f"{topic} {question}")
        overlap_count = len(answer_tokens.intersection(target_tokens))
        coverage = overlap_count / max(1, len(target_tokens))

        detail_score = min(35, int(word_count * 0.9))
        coverage_score = min(40, int(coverage * 100))
        reasoning_bonus = 10 if re.search(r"\b(because|therefore|for example|e\.g\.)\b", answer_clean, re.IGNORECASE) else 0
        clarity_bonus = 5 if "." in answer_clean and word_count >= 20 else 0
        score = self._clamp_score(15 + detail_score + coverage_score + reasoning_bonus + clarity_bonus)

        strengths: list[str] = []
        improvements: list[str] = []

        if word_count >= 35:
            strengths.append("You gave a reasonably detailed explanation instead of a one-line answer.")
        if coverage >= 0.25:
            strengths.append("You addressed several key terms from the question.")
        if reasoning_bonus > 0:
            strengths.append("You included reasoning language that helps justify your answer.")
        if not strengths:
            strengths.append("You attempted to answer directly, which is a good starting point.")

        if word_count < 25:
            improvements.append("Add more depth by explaining the idea step by step.")
        if coverage < 0.25:
            improvements.append("Address the main terms in the question more explicitly.")
        if reasoning_bonus == 0:
            improvements.append("Include cause-and-effect wording (for example, 'because' or 'therefore').")
        if not improvements:
            improvements.append("Add one concrete example to make the explanation more precise.")

        if score >= 80:
            comments = "Strong answer overall with clear understanding. Refine with an example to make it even sharper."
        elif score >= 60:
            comments = "Solid start. You show understanding, but the explanation needs more precision and depth."
        elif score >= 40:
            comments = "Partially correct. Expand the core idea and connect it more directly to the question."
        else:
            comments = "The response is too limited to assess full understanding. Rebuild the answer from first principles."

        return {
            "score": score,
            "comments": comments,
            "strengths": strengths,
            "improvements": improvements,
            "fallback": True,
        }

    def _build_answer_evaluation_prompt(
        self, topic: str, question: str, answer: str, reference_text: str | None
    ) -> str:
        reference = (reference_text or "").strip()
        if reference:
            reference = reference[:6000]
        else:
            reference = "None"

        return f"""You are a strict but fair university tutor.
Evaluate the student's answer against the question and topic.
Score from 0 to 100.
Give concise, actionable comments.
Do not include markdown.

Topic:
{topic}

Question:
{question}

Student answer:
{answer}

Reference material (optional):
{reference}

Return ONLY valid JSON with this schema:
{{
  "score": 0,
  "comments": "One short paragraph of feedback.",
  "strengths": ["bullet 1", "bullet 2"],
  "improvements": ["bullet 1", "bullet 2"]
}}
"""

    def _normalize_answer_evaluation(self, payload: dict, fallback: bool) -> dict:
        score = self._clamp_score(payload.get("score", 0))
        comments = str(payload.get("comments") or "").strip()
        strengths = self._normalize_text_list(payload.get("strengths"))
        improvements = self._normalize_text_list(payload.get("improvements"))

        if not comments:
            comments = "No detailed comment was returned by the evaluator."
        if not strengths:
            strengths = ["You attempted the question directly."]
        if not improvements:
            improvements = ["Add more specific reasoning and examples."]

        return {
            "score": score,
            "comments": comments,
            "strengths": strengths,
            "improvements": improvements,
            "fallback": fallback,
        }

    def _read_pdf_text(self, pdf_path: str | Path) -> str:
        path = Path(pdf_path).expanduser()
        if not path.exists():
            raise ValueError(f"PDF file not found: {path}")

        try:
            from pypdf import PdfReader
        except Exception as exc:
            raise ValueError(
                "pypdf is required to read PDF files. Install it with: pip install pypdf"
            ) from exc

        reader = PdfReader(str(path))
        pages: list[str] = []
        for page in reader.pages:
            pages.append((page.extract_text() or "").strip())

        text = "\n\n".join(part for part in pages if part).strip()
        if not text:
            raise ValueError(f"No text could be extracted from PDF: {path}")
        return text

    def socratic_viva(
        self,
        topic: str,
        previous_answer: str | None = None,
        student_query: str | None = None,
    ) -> dict:
        integrity = (
            self.check_academic_integrity(student_query)
            if student_query and student_query.strip()
            else None
        )
        if integrity and not integrity["is_acceptable"]:
            return {
                "question": (
                    "I cannot complete assignments for you. "
                    f"Instead, what have you already tried on '{topic}'?"
                ),
                "fallback": True,
                "integrity": integrity,
            }

        prompt_template = self._load_prompt("socratic_viva.txt")
        prompt = prompt_template.format(
            topic=topic,
            previous_answer=previous_answer or "No prior response.",
        )

        try:
            question = self._generate_text(prompt=prompt, temperature=0.4)
            return {"question": question, "fallback": False, "integrity": integrity}
        except Exception:
            question = self._fallback_socratic_question(topic=topic, previous_answer=previous_answer)
            return {"question": question, "fallback": True, "integrity": integrity}

    def socratic_viva_from_pdf(
        self,
        pdf_path: str | Path,
        topic: str,
        previous_answer: str | None = None,
        student_query: str | None = None,
        max_context_chars: int = 12000,
    ) -> dict:
        integrity = (
            self.check_academic_integrity(student_query)
            if student_query and student_query.strip()
            else None
        )
        if integrity and not integrity["is_acceptable"]:
            return {
                "question": (
                    "I cannot complete assignments for you. "
                    f"Instead, what have you already tried on '{topic}'?"
                ),
                "fallback": True,
                "integrity": integrity,
            }

        pdf_text = self._read_pdf_text(pdf_path)
        pdf_chunks = chunk_text(text=pdf_text, max_chunk_size=4000, overlap=200)
        material = "\n\n".join(pdf_chunks[:3]).strip()
        if max_context_chars > 0:
            material = material[:max_context_chars]

        prompt_template = self._load_prompt("socratic_viva.txt")
        scoped_topic = f"{topic}\n\nReference material:\n{material}"
        prompt = prompt_template.format(
            topic=scoped_topic,
            previous_answer=previous_answer or "No prior response.",
        )

        try:
            question = self._generate_text(prompt=prompt, temperature=0.4)
            return {"question": question, "fallback": False, "integrity": integrity}
        except Exception:
            question = self._fallback_socratic_question(topic=topic, previous_answer=previous_answer)
            return {"question": question, "fallback": True, "integrity": integrity}

    def evaluate_answer(
        self,
        topic: str,
        question: str,
        answer: str,
        reference_text: str | None = None,
    ) -> dict:
        if not self.enable_live:
            return self._heuristic_answer_evaluation(
                topic=topic,
                question=question,
                answer=answer,
            )

        prompt = self._build_answer_evaluation_prompt(
            topic=topic,
            question=question,
            answer=answer,
            reference_text=reference_text,
        )
        try:
            raw_text = self._generate_text(prompt=prompt, temperature=0.2)
            parsed_json = self._extract_json_safely(raw_text)
            if not isinstance(parsed_json, dict):
                raise ValueError("Model output must be a JSON object")
            return self._normalize_answer_evaluation(parsed_json, fallback=False)
        except Exception:
            return self._heuristic_answer_evaluation(
                topic=topic,
                question=question,
                answer=answer,
            )

    def _extract_json_safely(self, text: str) -> dict:
        cleaned = text.strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        markdown_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, re.DOTALL)
        if markdown_match:
            try:
                return json.loads(markdown_match.group(1))
            except json.JSONDecodeError:
                pass

        object_match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if object_match:
            return json.loads(object_match.group(0))

        raise ValueError("Could not parse JSON from model output")

    def _normalize_text_list(self, values: Any) -> list[str]:
        if not isinstance(values, list):
            return []
        normalized: list[str] = []
        seen: set[str] = set()
        for value in values:
            item = str(value).strip()
            key = item.lower()
            if not item or key in seen:
                continue
            seen.add(key)
            normalized.append(item)
        return normalized

    def _validate_career_schema(self, data: dict) -> None:
        required_fields = {
            "technical_skills": list,
            "tools_technologies": list,
            "cognitive_skills": list,
            "behavioural_traits": list,
            "experience_level": str,
        }
        for field, expected_type in required_fields.items():
            if field not in data:
                raise ValueError(f"Missing required field: {field}")
            if not isinstance(data[field], expected_type):
                raise ValueError(
                    f"Field '{field}' must be {expected_type.__name__}, got "
                    f"{type(data[field]).__name__}"
                )

    def _collect_keywords(self, text: str, keywords: list[str]) -> list[str]:
        text_lower = text.lower()
        found: list[str] = []
        for keyword in keywords:
            if keyword in text_lower:
                found.append(keyword.title())
        return found

    def _infer_experience_level(self, text: str) -> str:
        text_lower = text.lower()
        if re.search(r"\b(senior|lead|principal|5\+ years|7\+ years)\b", text_lower):
            return "Senior"
        if re.search(r"\b(junior|graduate|entry|intern|0-2 years)\b", text_lower):
            return "Graduate / Entry-level"
        if re.search(r"\b(mid|3\+ years|4\+ years)\b", text_lower):
            return "Mid-level"
        return "Not specified"

    def _heuristic_career_analysis(self, job_text: str) -> dict:
        return {
            "technical_skills": self._collect_keywords(job_text, self._TECHNICAL_SKILLS),
            "tools_technologies": self._collect_keywords(job_text, self._TOOLS),
            "cognitive_skills": self._collect_keywords(job_text, self._COGNITIVE),
            "behavioural_traits": self._collect_keywords(job_text, self._BEHAVIOURAL),
            "experience_level": self._infer_experience_level(job_text),
            "fallback": True,
        }

    def analyze_career_match(self, job_text: str) -> dict:
        prompt_template = self._load_prompt("career_analysis.txt")
        prompt = prompt_template.format(job_text=job_text)

        if not self.enable_live:
            return self._heuristic_career_analysis(job_text=job_text)

        try:
            raw_text = self._generate_text(prompt=prompt, temperature=0.2)
            parsed_json = self._extract_json_safely(raw_text)
            self._validate_career_schema(parsed_json)
            parsed_json["technical_skills"] = self._normalize_text_list(
                parsed_json.get("technical_skills")
            )
            parsed_json["tools_technologies"] = self._normalize_text_list(
                parsed_json.get("tools_technologies")
            )
            parsed_json["cognitive_skills"] = self._normalize_text_list(
                parsed_json.get("cognitive_skills")
            )
            parsed_json["behavioural_traits"] = self._normalize_text_list(
                parsed_json.get("behavioural_traits")
            )
            parsed_json["experience_level"] = str(
                parsed_json.get("experience_level", "Not specified")
            )
            parsed_json["fallback"] = False
            return parsed_json
        except Exception:
            return self._heuristic_career_analysis(job_text=job_text)

    def chunk_text(self, text: str, max_chunk_size: int = 1000, overlap: int = 100) -> list[str]:
        return chunk_text(text=text, max_chunk_size=max_chunk_size, overlap=overlap)

    def chunk_by_sentences(self, text: str, sentences_per_chunk: int = 5) -> list[str]:
        return chunk_by_sentences(text=text, sentences_per_chunk=sentences_per_chunk)

    def chunk_by_paragraphs(self, text: str, max_paragraphs: int = 3) -> list[str]:
        return chunk_by_paragraphs(text=text, max_paragraphs=max_paragraphs)
