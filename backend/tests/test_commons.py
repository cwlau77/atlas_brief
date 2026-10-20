import asyncio
import time
from datetime import datetime, timezone

import httpx
import pytest

from backend.ingestion.common import USER_AGENT
from backend.models import (
    Briefing, CommonsImage, KeyDevelopment, Place, PriorityAlert, SourceCitation,
)
from backend.synthesis import commons


@pytest.fixture(autouse=True)
def clear_cache():
    commons._cache.clear()
    yield
    commons._cache.clear()


def page(title, width=1024, mime="image/jpeg", artist="<a href='x'>Jane Doe</a>", lic="CC BY 4.0"):
    meta = {}
    if artist is not None:
        meta["Artist"] = {"value": artist}
    if lic is not None:
        meta["LicenseShortName"] = {"value": lic}
    return {
        "title": title,
        "imageinfo": [{
            "thumburl": f"https://upload.wikimedia.org/thumb/{title}",
            "url": f"https://upload.wikimedia.org/{title}",
            "descriptionurl": f"https://commons.wikimedia.org/wiki/{title}",
            "mime": mime, "width": width, "height": 700, "extmetadata": meta,
        }],
    }


def client_for(pages, calls=None, delay=0.0):
    async def handler(request):
        if calls is not None:
            calls.append(request)
        if delay:
            await asyncio.sleep(delay)
        return httpx.Response(200, json={"query": {"pages": {str(i): p for i, p in enumerate(pages)}}})
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


@pytest.mark.asyncio
async def test_filters_non_photos():
    pages = [
        page("File:Map.svg", mime="image/svg+xml"),
        page("File:Flag_of_Egypt.jpg"),
        page("File:Egypt_map_2020.jpg"),
        page("File:Coat_of_arms_Cairo.jpg"),
        page("File:Brand_logo.jpg"),
        page("File:Small_street.jpg", width=500),
        page("File:Cairo_street.jpg"),
    ]
    async with client_for(pages) as c:
        out = await commons.fetch_candidates(["Cairo"], c)
    assert [i.page_url.rsplit("/", 1)[-1] for i in out["Cairo"]] == ["File:Cairo_street.jpg"]


@pytest.mark.asyncio
async def test_requires_author_and_license():
    pages = [page("File:A.jpg", artist=None), page("File:B.jpg", lic=None), page("File:C.jpg")]
    async with client_for(pages) as c:
        out = await commons.fetch_candidates(["Cairo"], c)
    assert len(out["Cairo"]) == 1
    assert out["Cairo"][0].author == "Jane Doe"
    assert out["Cairo"][0].license == "CC BY 4.0"
    assert out["Cairo"][0].source == "commons"


@pytest.mark.asyncio
async def test_budget_exceeded_returns_empty():
    async with client_for([page("File:A.jpg")], delay=3) as c:
        t = time.monotonic()
        out = await commons.fetch_candidates(["Cairo", "Paris"], c, budget_s=0.2)
    assert time.monotonic() - t < 0.5
    assert out == {"Cairo": [], "Paris": []}


@pytest.mark.asyncio
async def test_cache_hits_second_call():
    calls = []
    async with client_for([page("File:A.jpg")], calls) as c:
        await commons.fetch_candidates(["Cairo"], c)
        out = await commons.fetch_candidates(["Cairo"], c)
    assert len(calls) == 1
    assert len(out["Cairo"]) == 1


@pytest.mark.asyncio
async def test_request_has_user_agent():
    calls = []
    async with client_for([page("File:A.jpg")], calls) as c:
        await commons.fetch_candidates(["Cairo"], c)
    assert calls[0].headers["user-agent"] == USER_AGENT
    assert "filetype:bitmap" in calls[0].url.params["gsrsearch"]


def img(n):
    return CommonsImage(url=f"https://x/{n}.jpg", page_url=f"https://c/{n}", author="a", license="l")


def cite(url, image_url=None):
    return SourceCitation(outlet="o", url=url, image_url=image_url)


def dev(name, url, image_url=None):
    return KeyDevelopment(
        headline="h", summary="s", regions=["R"], sources=[cite(url, image_url)],
        place=Place(name=name, country="EG", lat=0, lng=0),
    )


def alert(url):
    return PriorityAlert(severity="high", headline="h", rationale="r", sources=[cite(url)])


def briefing(devs, alerts):
    return Briefing(
        focus="f", generated_at=datetime.now(timezone.utc), key_developments=devs,
        emerging_tensions=[], contradictions=[], priority_alerts=alerts,
        recommended_readings=[], article_count=0, source_breakdown={},
    )


def test_query_for():
    assert commons.query_for(dev("Cairo", "u")) == "Cairo"
    d = KeyDevelopment(headline="h", summary="s", regions=["Sinai"], sources=[])
    assert commons.query_for(d) == "Sinai"
    d.regions = []
    assert commons.query_for(d) is None


def test_assign_distinct_and_alert_borrows_place():
    d0, d1, d2 = dev("Cairo", "u0"), dev("Cairo", "u1"), dev("Cairo", "u2", image_url="https://o/i.jpg")
    a_shared, a_none = alert("u0"), alert("nope")
    b = briefing([d0, d1, d2], [a_shared, a_none])
    commons.assign_images(b, {"Cairo": [img(1), img(2), img(3)]})
    assert d0.commons_image.url.endswith("/1.jpg")
    assert d1.commons_image.url.endswith("/2.jpg")
    assert d2.commons_image is None
    assert a_shared.commons_image.url.endswith("/3.jpg")
    assert a_none.commons_image is None
