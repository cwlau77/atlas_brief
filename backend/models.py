from datetime import datetime
from typing import Literal, Optional, get_args
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


# What kind of quantity a figure is; decides which figures may share a chart. Never shown.
FigureKind = Literal["people", "money", "share", "change", "count", "other"]
FIGURE_KINDS: tuple[str, ...] = get_args(FigureKind)


class KeyFigure(BaseModel):
    figure: str                        # verbatim from the source, hedge included: "nearly 14 million"
    label: str                         # Atlas's words: what it measures, <= 8 words
    kind: Optional[FigureKind] = None  # unknown values become None, which never charts
    period: Optional[str] = None       # verbatim from the same article ("in 2025"), else None
    source: SourceCitation             # the one article it was copied from


class KeyDevelopment(BaseModel):
    headline: str
    summary: str
    regions: list[str]
    sources: list[SourceCitation]
    historical_context: Optional[str] = None
    place: Optional[Place] = None
    commons_image: Optional[CommonsImage] = None
    key_figures: list[KeyFigure] = []  # absent in older briefings


# How a tension's actors relate; the frontend owns the words shown for each.
Relationship = Literal["in_conflict", "rivalry", "competing_claims", "pressure", "negotiating", "uneasy_partners"]
RELATIONSHIPS: tuple[str, ...] = get_args(Relationship)


class Tension(BaseModel):
    description: str
    actors: list[str]
    sources: list[SourceCitation]
    related_developments: Optional[list[int]] = None  # indexes into key_developments
    relationship: Optional[Relationship] = None  # absent in older briefings


class Contradiction(BaseModel):
    topic: str
    account_a: str
    account_b: str
    sources_a: list[SourceCitation]
    sources_b: list[SourceCitation]
    related_developments: Optional[list[int]] = None  # indexes into key_developments


class PriorityAlert(BaseModel):
    severity: Literal["critical", "high", "elevated"]
    headline: str
    rationale: str
    sources: list[SourceCitation]
    commons_image: Optional[CommonsImage] = None


# Whether an outlook item is stated by an article or is Atlas's own reading; the frontend owns the words.
Basis = Literal["reported", "assessment"]


class OutlookItem(BaseModel):
    statement: str
    basis: Basis
    quote: Optional[str] = None  # Reported only: the words found in a cited article's title or snippet
    sources: list[SourceCitation]  # Reported: the article(s) holding the quote. Assessment: what it reasons from
    watch_for: Optional[str] = None  # implications only
    related_developments: Optional[list[int]] = None  # indexes into key_developments


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
    # Absent in older briefings.
    trends: list[OutlookItem] = []
    implications: list[OutlookItem] = []
