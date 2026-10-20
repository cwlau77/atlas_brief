from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field

SourceType = Literal[
    "newsapi", "gdelt", "rss", "google_news", "guardian", "gnews", "newsdata",
    "brave", "tavily", "exa", "finnhub", "marketaux", "alphavantage",
]


class Article(BaseModel):
    title: str
    snippet: str
    url: str
    source: str
    published_at: Optional[datetime] = None
    country: Optional[str] = None
    raw_source_type: SourceType
    image_url: Optional[str] = None
    # The outlet the image came from; differs from `source` when dedupe handed over a dropped copy's image.
    image_outlet: Optional[str] = None


class BriefingRequest(BaseModel):
    focus: str = Field(..., min_length=2, max_length=200, description="Area of focus, e.g. 'South Asian security'")


class SourceCitation(BaseModel):
    outlet: str
    url: str
    published_at: Optional[datetime] = None
    image_url: Optional[str] = None
    image_outlet: Optional[str] = None


class Place(BaseModel):
    name: str
    country: str
    lat: float
    lng: float


class CommonsImage(BaseModel):
    url: str
    page_url: str
    author: str
    license: str
    source: Literal["commons"] = "commons"


class KeyDevelopment(BaseModel):
    headline: str
    summary: str
    regions: list[str]
    sources: list[SourceCitation]
    historical_context: Optional[str] = None
    place: Optional[Place] = None
    commons_image: Optional[CommonsImage] = None


class Tension(BaseModel):
    description: str
    actors: list[str]
    sources: list[SourceCitation]


class Contradiction(BaseModel):
    topic: str
    account_a: str
    account_b: str
    sources_a: list[SourceCitation]
    sources_b: list[SourceCitation]


class PriorityAlert(BaseModel):
    severity: Literal["critical", "high", "elevated"]
    headline: str
    rationale: str
    sources: list[SourceCitation]
    commons_image: Optional[CommonsImage] = None


class RecommendedReading(BaseModel):
    title: str
    outlet: str
    url: str
    why: str


class Briefing(BaseModel):
    focus: str
    generated_at: datetime
    key_developments: list[KeyDevelopment]
    emerging_tensions: list[Tension]
    contradictions: list[Contradiction]
    priority_alerts: list[PriorityAlert]
    recommended_readings: list[RecommendedReading]
    article_count: int
    source_breakdown: dict[str, int]
