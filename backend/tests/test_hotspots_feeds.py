import httpx
import pytest
import respx

from backend.hotspots_feeds import WORLD_DESKS, fetch_world_desks, parse_entries
from backend.ingestion.rss_source import RSS_FEEDS

_MEDIA_NS = 'xmlns:media="http://search.yahoo.com/mrss/"'


def _item(i: int) -> str:
    extra = {
        1: '<media:content url="https://img/1.jpg" medium="image"/>',
        2: '<media:thumbnail url="https://img/2.jpg"/>',
        3: '<enclosure type="image/jpeg" url="https://img/3.jpg" length="1"/>',
    }.get(i, "")
    return (f"<item><title>Story {i}</title><link>https://f.com/{i}</link>"
            f"<description>Body {i}</description>{extra}</item>")


FEED_40 = (f'<?xml version="1.0"?><rss version="2.0" {_MEDIA_NS}><channel><title>T</title>'
           + "".join(_item(i) for i in range(1, 41)) + "</channel></rss>")


def test_world_desks_are_all_in_rss_feeds():
    names = {n for n, _ in RSS_FEEDS}
    assert set(WORLD_DESKS) <= names and len(WORLD_DESKS) == 14


def test_parse_entries_keeps_every_entry_and_reads_images():
    arts = parse_entries("BBC World", FEED_40)
    assert len(arts) == 40
    assert [a.image_url for a in arts[:3]] == ["https://img/1.jpg", "https://img/2.jpg", "https://img/3.jpg"]
    assert arts[3].image_url is None
    assert arts[0].source == "BBC World"


def test_unparseable_feed_yields_no_articles():
    assert parse_entries("BBC World", "<html><body>502 Bad Gateway</body></html>") == []


@pytest.mark.asyncio
@respx.mock
async def test_fetch_world_desks_counts_answering_desks():
    urls = dict(RSS_FEEDS)
    for i, name in enumerate(WORLD_DESKS):
        if i == 0:
            respx.get(urls[name]).mock(return_value=httpx.Response(500))
        else:
            respx.get(urls[name]).mock(return_value=httpx.Response(200, text=FEED_40))
    async with httpx.AsyncClient() as client:
        arts, answered = await fetch_world_desks(client)
    assert answered == 13 and len(arts) == 13 * 40
