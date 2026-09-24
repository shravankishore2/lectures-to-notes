"""Split long transcripts into overlapping chunks so no single LLM call has to cover a 90-minute lecture."""

# Rough heuristic: 1 token ≈ 0.75 words. 3000 tokens ≈ 2250 words, 200-token overlap ≈ 150 words.
CHUNK_WORDS = 2250
OVERLAP_WORDS = 150


def chunk_text(text: str, chunk_words: int = CHUNK_WORDS, overlap_words: int = OVERLAP_WORDS) -> list[str]:
    words = text.split()
    if len(words) <= chunk_words:
        return [" ".join(words)] if words else []

    step = chunk_words - overlap_words
    chunks = []
    for start in range(0, len(words), step):
        chunk = words[start : start + chunk_words]
        chunks.append(" ".join(chunk))
        if start + chunk_words >= len(words):
            break
    return chunks


def chunk_lines(lines: list[str], chunk_words: int = CHUNK_WORDS, overlap_words: int = OVERLAP_WORDS) -> list[str]:
    """Like chunk_text, but never splits a line — used for timestamp-marked transcript lines."""
    if not lines:
        return []
    counts = [len(line.split()) for line in lines]
    chunks: list[str] = []
    start = 0
    while start < len(lines):
        end, words = start, 0
        while end < len(lines) and (words + counts[end] <= chunk_words or end == start):
            words += counts[end]
            end += 1
        chunks.append("\n".join(lines[start:end]))
        if end >= len(lines):
            break
        # step back far enough to give the next chunk ~overlap_words of shared context
        back, overlap = end, 0
        while back > start + 1 and overlap < overlap_words:
            back -= 1
            overlap += counts[back]
        start = back
    return chunks
