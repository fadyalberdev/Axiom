"""Pydantic schemas for RAG retrieval layer."""
from typing import Literal

from pydantic import BaseModel


class Chunk(BaseModel):
    """A retrieved knowledge chunk from the knowledge_chunks table."""

    id: str
    source_type: Literal["listing", "neighborhood", "blog"]
    source_id: str
    chunk_text: str
    metadata: dict
    score: float


class Citation(BaseModel):
    """A source citation for a RAG response."""

    source_type: Literal["listing", "neighborhood", "blog"]
    source_id: str
    title: str
    url: str


class RAGResponse(BaseModel):
    """Response from a RAG-augmented AI endpoint."""

    answer: str
    citations: list[Citation]
