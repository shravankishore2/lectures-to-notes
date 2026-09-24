import html

from .schema import NotesOutput, format_clock


def notes_to_markdown(notes: NotesOutput) -> str:
    lines = [f"# {notes.topic}", "", "## Summary", "", notes.summary, "", "## Cornell Notes", ""]
    lines += ["| Cue | Notes |", "|---|---|"]
    for n in notes.cornell_notes:
        cue = f"{_cell(n.cue)} *({format_clock(n.start)})*" if n.start is not None else _cell(n.cue)
        lines.append(f"| {cue} | {_cell(n.note)} |")
    lines += ["", "## Practice Questions", ""]
    for i, m in enumerate(notes.mcqs, start=1):
        lines.append(f"{i}. {m.question}")
        for j, opt in enumerate(m.options):
            lines.append(f"   - {chr(65 + j)}. {opt}")
        lines.append("")
    lines += ["<details><summary>Answer key</summary>", ""]
    for i, m in enumerate(notes.mcqs, start=1):
        letter = chr(65 + m.options.index(m.answer)) if m.answer in m.options else "?"
        lines.append(f"{i}. {letter} — {m.answer}")
    lines += ["", "</details>", ""]
    return "\n".join(lines)


def _cell(text: str) -> str:
    return text.replace("|", "\\|").replace("\n", "<br>")


def notes_to_anki(notes: NotesOutput, tag: str = "lecture-notes") -> str:
    """Tab-separated flashcards with Anki's import headers (File → Import picks up deck/columns automatically)."""
    deck = _anki_field(notes.topic)[:80]
    out = [
        "#separator:tab",
        "#html:true",
        "#columns:Front\tBack\tTags",
        f"#deck:{deck}",
        "#tags column:3",
    ]
    for n in notes.cornell_notes:
        back = _anki_field(n.note)
        if n.start is not None:
            back += f"<br><small>at {format_clock(n.start)}</small>"
        out.append(f"{_anki_field(n.cue)}\t{back}\t{tag} cue")
    for m in notes.mcqs:
        opts = "<br>".join(f"{chr(65 + j)}. {_anki_field(o)}" for j, o in enumerate(m.options))
        out.append(f"{_anki_field(m.question)}<br><br>{opts}\t{_anki_field(m.answer)}\t{tag} quiz")
    return "\n".join(out) + "\n"


def _anki_field(text: str) -> str:
    return html.escape(text, quote=False).replace("\t", " ").replace("\r", "").replace("\n", "<br>")
