"""
RAG retrieval layer for AXIOM AI.

Provides retrieve-then-generate infrastructure:
1. Embed query with nomic-embed-text
2. Hybrid search (vector + keyword) against knowledge_chunks
3. Build grounded context string for LLM system prompt
4. Format source citations for frontend rendering
"""
import logging

from app.ai.ollama_client import ollama
from app.ai.schemas import Chunk, Citation
from app.database import supabase_admin

logger = logging.getLogger(__name__)


class RAGRetriever:
    """Retrieves and formats relevant context from knowledge_chunks."""

    async def retrieve(
        self,
        query: str,
        source_type: str | None = None,
        k: int = 5,
    ) -> list[Chunk]:
        """
        Embed query and call hybrid_search_chunks RPC.
        Returns empty list on any failure — never raises.
        """
        try:
            embedding = await ollama.embed(query)
            if not embedding:
                return []

            result = supabase_admin.rpc(
                "hybrid_search_chunks",
                {
                    "query_text": query,
                    "query_embedding": embedding,
                    "match_count": k,
                    "filter_source": source_type,
                },
            ).execute()

            rows = result.data or []
            return [
                Chunk(
                    id=str(row["id"]),
                    source_type=row["source_type"],
                    source_id=str(row["source_id"]),
                    chunk_text=row["chunk_text"],
                    metadata=row.get("metadata") or {},
                    score=float(row.get("score", 0.0)),
                )
                for row in rows
            ]
        except Exception:
            logger.exception("RAGRetriever.retrieve() failed — returning empty list")
            return []

    def build_context(self, chunks: list[Chunk], max_chars: int = 3000) -> str:
        """
        Format chunks as a numbered context block for LLM injection.
        Each chunk prefixed with [N][source_type:source_id].
        Truncates at max_chars to avoid context overflow.
        """
        if not chunks:
            return ""

        lines: list[str] = []
        total = 0
        for i, chunk in enumerate(chunks, start=1):
            label = f"[{i}][{chunk.source_type}:{chunk.source_id}]"
            block = f"{label} {chunk.chunk_text}"
            if total + len(block) > max_chars:
                break
            lines.append(block)
            total += len(block) + 1

        return "\n".join(lines)

    def format_citations(self, chunks: list[Chunk]) -> list[Citation]:
        """
        Convert chunks to frontend-renderable Citation objects.
        Listings link to /property/{id}.
        Neighborhoods link to /find-homes?location={name}.
        Blog posts link to /blog/{source_id}.
        Deduplicates by source_id.
        """
        seen: set[str] = set()
        citations: list[Citation] = []

        for chunk in chunks:
            if chunk.source_id in seen:
                continue
            seen.add(chunk.source_id)

            if chunk.source_type == "listing":
                title = chunk.metadata.get("title") or chunk.chunk_text[:60]
                url = f"/property/{chunk.source_id}"
            elif chunk.source_type == "neighborhood":
                name = chunk.metadata.get("name") or chunk.source_id
                title = f"{name} neighborhood"
                url = f"/find-homes?location={name}"
            else:  # blog
                title = chunk.metadata.get("title") or "Blog post"
                url = f"/blog/{chunk.source_id}"

            citations.append(Citation(
                source_type=chunk.source_type,
                source_id=chunk.source_id,
                title=title,
                url=url,
            ))

        return citations


# Module-level singleton — import this in router.py
rag_retriever = RAGRetriever()
