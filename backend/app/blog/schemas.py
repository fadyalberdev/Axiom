from pydantic import BaseModel
from typing import Optional, Any


class BlogPostBriefResponse(BaseModel):
    id: str
    slug: str
    title: str
    excerpt: Optional[str] = None
    cover_image: Optional[str] = None
    published_at: Optional[str] = None
    tags: list[str] = []
    category: Optional[str] = None
    read_time: Optional[str] = None


class BlogPostDetailResponse(BaseModel):
    id: str
    slug: str
    title: str
    lead: Optional[str] = None
    excerpt: Optional[str] = None
    cover_image: Optional[str] = None
    content: list[Any] = []
    tags: list[str] = []
    category: Optional[str] = None
    read_time: Optional[str] = None
    published_at: Optional[str] = None
    author_id: str
    created_at: str
