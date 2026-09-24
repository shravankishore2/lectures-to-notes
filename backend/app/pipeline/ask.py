"""Answer a student's question about one lecture, grounded in its transcript."""

from pydantic import BaseModel, Field

from . import llm
from .schema import Transcript, parse_timestamp

MAX_HISTORY = 6
MAX_QUESTION_CHARS = 1000

ASK_PROMPT = """You are a tutor answering a student's question about ONE lecture. Use only the transcript below.
If the lecture doesn't cover it, say so plainly and suggest what the lecture does cover that's closest.

Return ONLY a JSON object:
{{
  "answer": "a clear answer in 1-3 short paragraphs of plain text (no markdown headings)",
  "timestamps": ["up to 3 [m:ss] markers copied from the transcript lines that support the answer"]
}}

Lecture title: {title}

Transcript (each line starts with its [m:ss] timestamp):
\"\"\"
{transcript}
\"\"\"
{history}
Student's question: {question}
"""


class AskTurn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(max_length=4000)


class AskAnswer(BaseModel):
    answer: str
    timestamps: list[float]


def answer_question(transcript: Transcript, title: str, question: str, history: list[AskTurn] | None = None) -> AskAnswer:
    history_text = ""
    if history:
        turns = history[-MAX_HISTORY:]
        history_text = "\nEarlier in this conversation:\n" + "\n".join(
            f"{'Student' if t.role == 'user' else 'Tutor'}: {t.content}" for t in turns
        ) + "\n"
    prompt = ASK_PROMPT.format(
        title=title,
        transcript="\n".join(transcript.marked_lines()),
        history=history_text,
        question=question[:MAX_QUESTION_CHARS],
    )
    raw = llm.generate_json(llm.client(), llm.model_chain(), prompt, temperature=0.2)
    stamps = [t for t in (parse_timestamp(x) for x in raw.get("timestamps") or []) if t is not None]
    return AskAnswer(answer=str(raw.get("answer") or "").strip() or "Sorry — I couldn't produce an answer.", timestamps=stamps[:3])
