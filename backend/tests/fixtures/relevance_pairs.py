"""Hand-labeled (focus, title, snippet, is_relevant) pairs for validating the
relevance filter. These document expected behavior AND known limitations:

- The glacier item is climate-relevant to a human but shares no vocabulary with
  the focus aliases, so the local TF-IDF embedder cannot rescue it (expected FN).
- The bird-migration item keyword-hits "migration" despite being off-topic for a
  geopolitics product (expected FP).
Both are priced into the precision/recall floors asserted in test_relevance.py.
"""

LABELED: list[tuple[str, str, str, bool]] = [
    # focus: climate
    ("climate", "EU tightens 2035 emissions targets after summer heatwaves",
     "Brussels moves to cut carbon output across the bloc.", True),
    ("climate", "Solar and wind hit record share of global electricity",
     "Renewable generation outpaced coal for the first time.", True),
    ("climate", "Delegates arrive for COP31 talks in Nairobi",
     "Negotiators face pressure over climate finance pledges.", True),
    ("climate", "Glaciers retreat at fastest pace on record, scientists warn",
     "Melting ice sheets accelerate sea level rise.", True),
    ("climate", "Copenhagen fashion week opens with retro collection",
     "Designers debut autumn lines in the Danish capital.", False),
    ("climate", "Champions League final preview: tactics and predictions",
     "Football fans await the showdown in Madrid.", False),
    # focus: south asian security
    ("south asian security", "India and Pakistan trade fire across Kashmir line of control",
     "Military exchanges escalate along the disputed frontier.", True),
    ("south asian security", "Sri Lanka signs defense pact with regional partners",
     "Colombo strengthens security cooperation in the Indian Ocean.", True),
    ("south asian security", "Missile test triggers alarm in the region",
     "Neighbors condemn the launch as destabilizing South Asia.", True),
    ("south asian security", "Southampton win promotion in dramatic playoff final",
     "Supporters flood the pitch after the final whistle.", False),
    ("south asian security", "Tech giant unveils new smartphone lineup",
     "The flagship device ships next month.", False),
    # focus: trade
    ("trade", "Washington imposes sweeping tariffs on steel imports",
     "The measures target overcapacity in foreign mills.", True),
    ("trade", "Port congestion snarls global supply chain ahead of holidays",
     "Shippers warn of delays at major container terminals.", True),
    ("trade", "Ministers meet to revive stalled trade negotiations",
     "Officials seek a framework before the summit deadline.", True),
    ("trade", "Hollywood actor trades quips at movie premiere",
     "The star delighted fans on the red carpet.", False),
    ("trade", "New museum exhibit explores renaissance art",
     "Curators assembled works from a dozen collections.", False),
    # focus: migration
    ("migration", "Mediterranean crossings surge as smugglers exploit calm seas",
     "Aid groups report record numbers of migrants rescued.", True),
    ("migration", "EU states clash over asylum quota reform",
     "Interior ministers remain deadlocked on burden sharing.", True),
    ("migration", "Thousands displaced as border camp cleared",
     "Authorities moved residents to temporary shelters.", True),
    ("migration", "Bird migration patterns shift with warming seasons",
     "Ornithologists track earlier spring arrivals.", False),
    ("migration", "Streaming service raises subscription prices",
     "The company cited rising content costs.", False),
]
