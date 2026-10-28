from datetime import datetime, timedelta, timezone

from backend.hotspots import Cutoffs, build_snapshot, cutoffs_for, merge_store
from backend.models import Article
from backend.processing.urls import normalize_url

NOW = datetime(2026, 10, 27, 14, 0, tzinfo=timezone.utc)


def art(title, hours_ago=1, outlet="BBC World", snippet=None, url=None) -> Article:
    return Article(
        title=title,
        snippet=title if snippet is None else snippet,
        url=url or f"https://example.com/{abs(hash((title, outlet)))}",
        source=outlet,
        published_at=None if hours_ago is None else NOW - timedelta(hours=hours_ago),
        raw_source_type="rss",
    )


def store_of(articles):
    return {normalize_url(a.url): a for a in articles}


def by_iso(snap):
    return {c.iso2: c for c in snap.countries}


def test_counts_once_per_article_per_country():
    snap = build_snapshot(store_of([art("Ukraine and Russia talk; Kyiv hopeful", hours_ago=1)]), feeds=14, now=NOW)
    assert {c.iso2: c.n for c in snap.countries} == {"UA": 1, "RU": 1}


def test_merge_store_drops_old_undated_and_future():
    s = merge_store({}, [art("A", hours_ago=25), art("B", hours_ago=None), art("C", hours_ago=-1), art("D", hours_ago=2)], NOW)
    assert [a.title for a in s.values()] == ["D"]


def test_merge_store_keeps_existing_and_expires_them():
    old = art("Old one", hours_ago=23)
    kept = merge_store(store_of([old]), [art("New one", hours_ago=1)], NOW)
    assert {a.title for a in kept.values()} == {"Old one", "New one"}
    later = merge_store(kept, [], NOW + timedelta(hours=2))
    assert {a.title for a in later.values()} == {"New one"}


def test_same_title_from_two_outlets_counts_once():
    a = art("Kyiv hit - Reuters", outlet="BBC World", hours_ago=3)
    b = art("Kyiv hit", outlet="CNN World", hours_ago=2)
    snap = build_snapshot(store_of([a, b]), feeds=2, now=NOW)
    assert by_iso(snap)["UA"].n == 1
    assert snap.total_articles == 1


def test_cutoffs_use_shares_with_floors():
    assert cutoffs_for(100) == Cutoffs(active=3, elevated=8, high=15)
    assert cutoffs_for(1000) == Cutoffs(active=15, elevated=40, high=80)


def test_coverage_is_median_feed_depth_and_hourly_spans_it():
    arts = [
        art("Ukraine war news", hours_ago=20, outlet="A"),
        art("Ukraine talks continue", hours_ago=1, outlet="A"),
        art("Ukraine aid package", hours_ago=6, outlet="B"),
        art("Ukraine grid repairs", hours_ago=9, outlet="C"),
    ]
    snap = build_snapshot(store_of(arts), feeds=3, now=NOW)
    assert snap.coverage_hours == 9
    assert all(len(c.hourly) == 9 for c in snap.countries)
    ua = by_iso(snap)["UA"]
    assert ua.n == 4
    # oldest first: bucket 8 is the newest hour [0h,1h); the 9h-old article sits just outside it.
    assert ua.hourly[8] == 0
    assert ua.hourly[7] == 1          # 1h old -> [1h, 2h)
    assert ua.hourly[2] == 1          # 6h old -> [6h, 7h)
    assert sum(ua.hourly) == 2        # the 9h and 20h articles fall before the window


def test_coverage_is_clamped():
    snap = build_snapshot(store_of([art("Ukraine news", hours_ago=0.2)]), feeds=1, now=NOW)
    assert snap.coverage_hours == 1
    assert by_iso(snap)["UA"].hourly == [1]


def test_with_needs_three_shared_articles():
    arts = [
        art("Ukraine and Russia exchange fire", outlet="A"),
        art("Russia warns Ukraine over drones", outlet="B"),
        art("Ukraine, Russia swap prisoners", outlet="C"),
        art("Ukraine and Turkey discuss grain", outlet="D"),
        art("Turkey hosts Ukraine envoys", outlet="E"),
    ]
    snap = build_snapshot(store_of(arts), feeds=5, now=NOW)
    assert by_iso(snap)["UA"].with_ == ["RU"]
    assert by_iso(snap)["TR"].with_ == []


def test_with_serialises_as_with():
    snap = build_snapshot(store_of([art("Ukraine news")]), feeds=1, now=NOW)
    dumped = snap.model_dump(by_alias=True, mode="json")
    assert dumped["countries"][0]["with"] == []
    assert "with_" not in dumped["countries"][0]


def test_story_picks_most_shared_headline_and_trims_blurb():
    arts = [
        art("Ukraine power grid hit by overnight strikes", outlet="A", hours_ago=1,
            snippet="First sentence here. Second."),
        art("Power grid repairs begin across Ukraine", outlet="B", hours_ago=2),
        art("Ukraine grid operator warns of power cuts", outlet="C", hours_ago=4),
        art("Ukraine wins chess title", outlet="D", hours_ago=1.5),
    ]
    snap = build_snapshot(store_of(arts), feeds=4, now=NOW)
    story = by_iso(snap)["UA"].story
    assert story is not None
    # the three grid titles tie on shared words; the newest wins, and the outlier never does.
    assert story.headline == "Ukraine power grid hit by overnight strikes"
    assert story.blurb == "First sentence here."
    assert story.image is None


def test_story_blurb_cut_at_thirty_words():
    long_snippet = " ".join(f"word{i}" for i in range(40)) + "."
    arts = [art(f"Ukraine power grid {w}", outlet=f"O{i}", hours_ago=i + 1,
                snippet=long_snippet if i == 0 else None) for i, w in enumerate(["alpha", "bravo", "charlie"])]
    story = by_iso(build_snapshot(store_of(arts), feeds=3, now=NOW))["UA"].story
    assert story.article.title == "Ukraine power grid alpha"
    assert story.blurb == " ".join(f"word{i}" for i in range(30)) + "…"


def test_story_strips_outlet_suffix_from_headline():
    arts = [art("Kyiv grid attacked - Reuters", outlet="A"), art("Kyiv grid attacked again", outlet="B"),
            art("Kyiv grid repairs", outlet="C")]
    story = by_iso(build_snapshot(store_of(arts), feeds=3, now=NOW))["UA"].story
    assert " - Reuters" not in story.headline


def test_blurb_is_none_when_snippet_is_just_the_title():
    arts = [art(f"Ukraine power grid hit {i}", outlet=o) for i, o in enumerate("ABC")]
    story = by_iso(build_snapshot(store_of(arts), feeds=3, now=NOW))["UA"].story
    assert story.blurb is None


def test_quiet_countries_have_no_story_and_tiers_follow_cutoffs():
    arts = [art("Ukraine news one"), art("Ukraine news two", outlet="B"), art("Japan holds vote", outlet="C")]
    snap = build_snapshot(store_of(arts), feeds=3, now=NOW)
    ua = by_iso(snap)["UA"]
    assert (ua.tier, ua.story) == ("quiet", None)
    assert by_iso(snap)["JP"].story is None


def test_active_tier_has_story_and_countries_sorted():
    arts = [art(f"Ukraine report {i}", outlet=f"O{i}") for i in range(3)] + [art("Japan vote", outlet="J")]
    snap = build_snapshot(store_of(arts), feeds=4, now=NOW)
    assert [c.iso2 for c in snap.countries] == ["UA", "JP"]
    assert by_iso(snap)["UA"].tier == "active" and by_iso(snap)["UA"].story is not None
    assert snap.cutoffs == Cutoffs(active=3, elevated=8, high=15)
    assert snap.feeds == 4 and snap.window_hours == 24


def test_empty_store():
    snap = build_snapshot({}, feeds=0, now=NOW)
    assert snap.countries == [] and snap.total_articles == 0 and snap.coverage_hours == 1
