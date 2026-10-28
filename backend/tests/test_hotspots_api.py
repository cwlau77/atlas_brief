import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

import backend.main as main
from backend import hotspots
from backend.config import settings
from backend.models import CommonsImage


def _articles(make_article, image_url=None):
    now = datetime.now(timezone.utc)
    return [
        make_article(title=f"Ukraine and Russia talks, round {i}", snippet="Kyiv and Moscow negotiators met.",
                     url=f"https://example.com/ua{i}", source="BBC World",
                     published_at=now - timedelta(minutes=10 * i), image_url=image_url)
        for i in range(1, 6)
    ]


@pytest.fixture(autouse=True)
def fresh_cache(monkeypatch):
    monkeypatch.setattr(settings, "hotspots_ttl_minutes", 60)
    monkeypatch.setattr(settings, "commons_images_enabled", True)
    hotspots.reset_cache()
    yield
    hotspots.reset_cache()


@pytest.fixture
def feed(monkeypatch, make_article):
    """Mock the desks and Commons; `state` counts calls and can be told to fail."""
    state = {"fetch": 0, "commons": 0, "fail": False, "articles": _articles(make_article)}

    async def fake_fetch(client):
        state["fetch"] += 1
        if state["fail"]:
            raise RuntimeError("feeds down")
        return state["articles"], 14

    async def fake_candidates(queries, client, budget_s=1.5):
        state["commons"] += 1
        state["budget"] = budget_s
        return {q: [CommonsImage(url="https://upload.example/p.jpg", page_url="https://c/p",
                                 author="A", license="CC BY")] for q in queries}

    monkeypatch.setattr(hotspots, "fetch_world_desks", fake_fetch)
    monkeypatch.setattr(hotspots, "fetch_candidates", fake_candidates)
    return state


async def _drain():
    await asyncio.gather(*list(hotspots._tasks))


@pytest.mark.asyncio
async def test_cold_start_builds_and_caches(feed):
    first = await hotspots.get_hotspots()
    second = await hotspots.get_hotspots()
    assert first is second
    assert feed["fetch"] == 1
    assert {c.iso2 for c in first.countries} >= {"UA", "RU"}


@pytest.mark.asyncio
async def test_expired_snapshot_is_served_stale_then_rebuilt(feed, monkeypatch):
    monkeypatch.setattr(settings, "hotspots_ttl_minutes", 0)
    first = await hotspots.get_hotspots()
    second = await hotspots.get_hotspots()
    assert second.generated_at == first.generated_at  # stale, served immediately
    await _drain()
    assert feed["fetch"] == 2
    third = await hotspots.get_hotspots()
    assert third.generated_at > first.generated_at
    await _drain()


@pytest.mark.asyncio
async def test_only_one_background_rebuild_at_a_time(feed, monkeypatch):
    monkeypatch.setattr(settings, "hotspots_ttl_minutes", 0)
    await hotspots.get_hotspots()
    await asyncio.gather(hotspots.get_hotspots(), hotspots.get_hotspots(), hotspots.get_hotspots())
    await _drain()
    assert feed["fetch"] == 2


@pytest.mark.asyncio
async def test_failed_rebuild_keeps_last_snapshot(feed, monkeypatch):
    monkeypatch.setattr(settings, "hotspots_ttl_minutes", 0)
    first = await hotspots.get_hotspots()
    feed["fail"] = True
    await hotspots.get_hotspots()
    await _drain()
    again = await hotspots.get_hotspots()
    assert again.generated_at == first.generated_at
    await _drain()
    assert feed["fetch"] == 2  # the failure back-off stops a retry on every request


@pytest.mark.asyncio
async def test_cold_failure_returns_none_and_backs_off(feed):
    feed["fail"] = True
    assert await hotspots.get_hotspots() is None
    assert await hotspots.get_hotspots() is None
    assert feed["fetch"] == 1


@pytest.mark.asyncio
async def test_hung_build_times_out_as_a_failure(feed, monkeypatch):
    async def hanging_fetch(client):
        feed["fetch"] += 1
        await asyncio.sleep(30)

    monkeypatch.setattr(hotspots, "fetch_world_desks", hanging_fetch)
    monkeypatch.setattr(hotspots, "BUILD_DEADLINE_S", 0.05)
    assert await asyncio.wait_for(hotspots.get_hotspots(), 2) is None
    assert await hotspots.get_hotspots() is None  # backed off, not queued behind the hung build
    assert feed["fetch"] == 1


@pytest.mark.asyncio
async def test_hung_background_rebuild_frees_the_next_one(feed, monkeypatch):
    monkeypatch.setattr(settings, "hotspots_ttl_minutes", 0)
    first = await hotspots.get_hotspots()

    async def hanging_fetch(client):
        await asyncio.sleep(30)

    monkeypatch.setattr(hotspots, "fetch_world_desks", hanging_fetch)
    monkeypatch.setattr(hotspots, "BUILD_DEADLINE_S", 0.05)
    assert await hotspots.get_hotspots() is first
    await asyncio.wait_for(_drain(), 2)
    assert hotspots._rebuild_task.done()
    assert (await hotspots.get_hotspots()) is first


@pytest.mark.asyncio
async def test_zero_articles_is_a_failure(feed):
    feed["articles"] = []
    assert await hotspots.get_hotspots() is None


@pytest.mark.asyncio
async def test_article_image_beats_commons(feed, make_article):
    feed["articles"] = _articles(make_article, image_url="https://img.example/a.jpg")
    snap = await hotspots.get_hotspots()
    story = next(c for c in snap.countries if c.iso2 == "UA").story
    assert story.image.url == "https://img.example/a.jpg"
    assert story.image.credit == "BBC World"
    assert feed["commons"] == 0


@pytest.mark.asyncio
async def test_commons_photo_used_when_article_has_none(feed):
    snap = await hotspots.get_hotspots()
    story = next(c for c in snap.countries if c.iso2 == "UA").story
    assert story.image.url == "https://upload.example/p.jpg"
    assert story.image.credit == "File photo · Wikimedia Commons"
    assert feed["budget"] == 2.0


@pytest.mark.asyncio
async def test_commons_skipped_when_disabled(feed, monkeypatch):
    monkeypatch.setattr(settings, "commons_images_enabled", False)
    snap = await hotspots.get_hotspots()
    assert next(c for c in snap.countries if c.iso2 == "UA").story.image is None
    assert feed["commons"] == 0


@pytest.fixture
def client(feed):
    return TestClient(main.app)


def test_cold_failure_returns_503(client, feed):
    feed["fail"] = True
    resp = client.get("/hotspots")
    assert resp.status_code == 503
    assert resp.json() == {"detail": "Hotspots unavailable"}


def test_endpoint_serialises_with_alias(client):
    resp = client.get("/hotspots")
    assert resp.status_code == 200
    body = resp.json()
    country = next(c for c in body["countries"] if c["iso2"] == "UA")
    assert "with" in country and "with_" not in country
    assert body["feeds"] == 14
