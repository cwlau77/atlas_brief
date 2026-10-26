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
    commons._backfilling.clear()
    yield
    commons._tasks.clear()  # tests that start backfills await them; the loop is gone by now
    commons._cache.clear()
    commons._backfilling.clear()


@pytest.fixture
def no_backfill(monkeypatch):
    """No background lookups, so no test reaches the network or outlives its event loop."""
    scheduled = []
    monkeypatch.setattr(commons, "_schedule_backfill", scheduled.append)
    return scheduled


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


def client_for(pages, calls=None, delay=0.0, lead=None, lead_page=None, search_delay=0.0):
    """Mock Wikipedia and Commons. `pages` answers the Commons search; `lead` is the Wikipedia
    pageimage file name (None: the article has none) and `lead_page` its Commons imageinfo page.
    `delay` slows every request, `search_delay` only the Commons search."""
    async def handler(request):
        if calls is not None:
            calls.append(request)
        if delay:
            await asyncio.sleep(delay)
        if search_delay and "gsrsearch" in request.url.params:
            await asyncio.sleep(search_delay)
        if request.url.host == "en.wikipedia.org":
            title = request.url.params["titles"]
            found = {"1": {"pageid": 1, "title": title, "pageimage": lead}} if lead else {"-1": {"title": title, "missing": ""}}
            return httpx.Response(200, json={"query": {"pages": found}})
        if "titles" in request.url.params:
            return httpx.Response(200, json={"query": {"pages": {"1": lead_page} if lead_page else {}}})
        return httpx.Response(200, json={"query": {"pages": {str(i): p for i, p in enumerate(pages)}}})
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def names(images):
    return [i.page_url.rsplit("/", 1)[-1] for i in images]


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
async def test_budget_exceeded_returns_empty(no_backfill):
    async with client_for([page("File:A.jpg")], delay=3) as c:
        t = time.monotonic()
        out = await commons.fetch_candidates(["Cairo", "Paris"], c, budget_s=0.2)
    assert time.monotonic() - t < 0.5
    assert out == {"Cairo": [], "Paris": []}


@pytest.mark.asyncio
async def test_slow_search_keeps_the_lead_image(no_backfill):
    async with client_for([page("File:A.jpg")], lead="B.jpg", lead_page=page("File:B.jpg"), search_delay=3) as c:
        t = time.monotonic()
        out = await commons.fetch_candidates(["Cairo"], c, budget_s=0.3)
    assert time.monotonic() - t < 0.6
    assert names(out["Cairo"]) == ["File:B.jpg"]
    assert "Cairo" not in commons._cache  # partial, so not cached
    assert no_backfill == ["Cairo"]


@pytest.mark.asyncio
async def test_overrun_backfills_the_cache(monkeypatch):
    monkeypatch.setattr(commons, "_new_client", lambda: client_for(
        [page("File:A.jpg")], lead="B.jpg", lead_page=page("File:B.jpg")))
    async with client_for([page("File:A.jpg")], lead="B.jpg", lead_page=page("File:B.jpg"), search_delay=3) as c:
        await commons.fetch_candidates(["Cairo"], c, budget_s=0.2)
    await asyncio.gather(*list(commons._tasks))
    assert names(commons._cache["Cairo"][1]) == ["File:B.jpg", "File:A.jpg"]
    assert "Cairo" not in commons._backfilling


@pytest.mark.asyncio
async def test_backfill_client_waits_as_long_as_a_cold_search():
    # A cold Commons search can take ~7s; a shorter read timeout would make every backfill fail.
    async with commons._new_client() as c:
        assert c.timeout.read >= commons.BACKFILL_S
        assert c.headers["user-agent"] == USER_AGENT


@pytest.mark.asyncio
async def test_one_backfill_per_query(monkeypatch):
    made = []

    def factory():
        made.append(1)
        return client_for([page("File:A.jpg")], search_delay=0.2)
    monkeypatch.setattr(commons, "_new_client", factory)
    async with client_for([], search_delay=3) as c:
        await asyncio.gather(commons.fetch_candidates(["Cairo"], c, budget_s=0.1),
                             commons.fetch_candidates(["Cairo"], c, budget_s=0.1))
    await asyncio.gather(*list(commons._tasks))
    assert len(made) == 1


@pytest.mark.asyncio
async def test_backfill_failure_is_swallowed(monkeypatch):
    def boom():
        raise RuntimeError("down")
    monkeypatch.setattr(commons, "_new_client", boom)
    async with client_for([], search_delay=3) as c:
        await commons.fetch_candidates(["Cairo"], c, budget_s=0.1)
    await asyncio.gather(*list(commons._tasks))
    assert "Cairo" not in commons._cache and "Cairo" not in commons._backfilling


@pytest.mark.asyncio
async def test_cache_hits_second_call():
    calls = []
    async with client_for([page("File:A.jpg")], calls, lead="B.jpg", lead_page=page("File:B.jpg")) as c:
        await commons.fetch_candidates(["Cairo"], c)
        first = len(calls)
        out = await commons.fetch_candidates(["Cairo"], c)
    assert first == 3  # Wikipedia pageimage, its Commons imageinfo, the Commons search
    assert len(calls) == first
    assert names(out["Cairo"]) == ["File:B.jpg", "File:A.jpg"]


@pytest.mark.asyncio
async def test_request_has_user_agent():
    calls = []
    async with client_for([page("File:A.jpg")], calls, lead="B.jpg", lead_page=page("File:B.jpg")) as c:
        await commons.fetch_candidates(["Cairo"], c)
    assert calls and all(r.headers["user-agent"] == USER_AGENT for r in calls)
    search = next(r for r in calls if "gsrsearch" in r.url.params)
    assert "filetype:bitmap" in search.url.params["gsrsearch"]


@pytest.mark.asyncio
async def test_prefers_the_places_wikipedia_lead_image():
    calls = []
    lead = page("File:Cairo skyline.jpg")
    async with client_for([page("File:Church dome mosaic.jpg")], calls, lead="Cairo skyline.jpg", lead_page=lead) as c:
        out = await commons.fetch_candidates(["Cairo"], c)
    assert names(out["Cairo"]) == ["File:Cairo skyline.jpg", "File:Church dome mosaic.jpg"]
    wiki = next(r for r in calls if r.url.host == "en.wikipedia.org")
    assert str(wiki.url).startswith("https://en.wikipedia.org/w/api.php")
    assert dict(wiki.url.params) == {
        "action": "query", "prop": "pageimages", "piprop": "name", "titles": "Cairo",
        "redirects": "1", "format": "json",
    }
    info = next(r for r in calls if r.url.host == "commons.wikimedia.org" and "titles" in r.url.params)
    assert info.url.params["titles"] == "File:Cairo skyline.jpg"
    assert info.url.params["prop"] == "imageinfo"
    assert info.url.params["iiprop"] == "url|extmetadata|mime|size"
    assert info.url.params["iiurlwidth"] == "800"


@pytest.mark.asyncio
async def test_falls_back_to_a_biased_search_without_a_lead_image():
    calls = []
    async with client_for([page("File:Cairo street.jpg")], calls, lead=None) as c:
        out = await commons.fetch_candidates(["Cairo"], c)
    assert names(out["Cairo"]) == ["File:Cairo street.jpg"]
    search = next(r for r in calls if "gsrsearch" in r.url.params)
    assert search.url.params["gsrsearch"] == "Cairo skyline OR cityscape OR panorama OR street filetype:bitmap"


@pytest.mark.asyncio
async def test_lead_image_goes_through_the_same_filters():
    async with client_for([page("File:Cairo street.jpg")], lead="Flag of Egypt.jpg", lead_page=page("File:Flag of Egypt.jpg")) as c:
        out = await commons.fetch_candidates(["Cairo"], c)
    assert names(out["Cairo"]) == ["File:Cairo street.jpg"]
    commons._cache.clear()
    small = page("File:Cairo small.jpg", width=320)
    async with client_for([], lead="Cairo small.jpg", lead_page=small) as c:
        out = await commons.fetch_candidates(["Cairo"], c)
    assert out["Cairo"] == []


@pytest.mark.asyncio
async def test_a_failed_lead_lookup_still_uses_the_search():
    async def handler(request):
        if request.url.host == "en.wikipedia.org":
            return httpx.Response(500)
        return httpx.Response(200, json={"query": {"pages": {"0": page("File:Cairo street.jpg")}}})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as c:
        out = await commons.fetch_candidates(["Cairo"], c)
    assert names(out["Cairo"]) == ["File:Cairo street.jpg"]


def test_denylist_matches_whole_words_only():
    titles = [
        "File:Mapleton main street.jpg", "File:Seal Beach pier.jpg", "File:Chartres cathedral.jpg",
        "File:Flag of Egypt.jpg", "File:Seal of California.jpg", "File:Egypt map 2020.jpg",
        "File:Coat_of_arms_Cairo.jpg", "File:Nile_delta_maps.jpg",
    ]
    out = commons._parse({"query": {"pages": {str(i): page(t) for i, t in enumerate(titles)}}})
    assert names(out) == ["File:Mapleton main street.jpg", "File:Seal Beach pier.jpg", "File:Chartres cathedral.jpg"]


def test_skips_files_with_overlong_authors():
    out = commons._parse({"query": {"pages": {
        "0": page("File:Long.jpg", artist="x" * 121),
        "1": page("File:Ok.jpg", artist="y" * 120),
    }}})
    assert names(out) == ["File:Ok.jpg"]
    assert out[0].author == "y" * 120  # kept whole, never truncated


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


@pytest.mark.asyncio
async def test_lead_image_is_not_repeated_within_a_briefing():
    async with client_for([page("File:Cairo street.jpg")], lead="Cairo skyline.jpg", lead_page=page("File:Cairo skyline.jpg")) as c:
        cands = await commons.fetch_candidates(["Cairo"], c)
    d0, d1, d2 = dev("Cairo", "u0"), dev("Cairo", "u1"), dev("Cairo", "u2")
    commons.assign_images(briefing([d0, d1, d2], []), cands)
    assert names([d0.commons_image, d1.commons_image]) == ["File:Cairo skyline.jpg", "File:Cairo street.jpg"]
    assert d2.commons_image is None


def test_assign_distinct_and_alert_borrows_place():
    d0, d1, d2 = dev("Cairo", "u0"), dev("Cairo", "u1"), dev("Cairo", "u2", image_url="https://o/i.jpg")
    a_shared, a_none = alert("u0"), alert("nope")
    b = briefing([d0, d1, d2], [a_shared, a_none])
    commons.assign_images(b, {"Cairo": [img(1), img(2), img(3), img(4)]})
    assert d0.commons_image.url.endswith("/1.jpg")
    assert d1.commons_image.url.endswith("/2.jpg")
    assert d2.commons_image.url.endswith("/3.jpg")  # a fallback behind its outlet photo
    assert a_shared.commons_image.url.endswith("/4.jpg")
    assert a_none.commons_image is None


def test_photo_less_developments_pick_first():
    with_photo = dev("Cairo", "u0", image_url="https://o/i.jpg")
    bare = dev("Cairo", "u1")
    commons.assign_images(briefing([with_photo, bare], []), {"Cairo": [img(1), img(2)]})
    assert bare.commons_image.url.endswith("/1.jpg")
    assert with_photo.commons_image.url.endswith("/2.jpg")


def test_alert_with_outlet_photo_gets_a_fallback_after_bare_alerts():
    d0 = dev("Cairo", "u0")
    a_photo = PriorityAlert(severity="high", headline="h", rationale="r", sources=[cite("u0", "https://o/a.jpg")])
    a_bare = alert("u0")
    commons.assign_images(briefing([d0], [a_photo, a_bare]), {"Cairo": [img(1), img(2), img(3)]})
    assert d0.commons_image.url.endswith("/1.jpg")
    assert a_bare.commons_image.url.endswith("/2.jpg")
    assert a_photo.commons_image.url.endswith("/3.jpg")
