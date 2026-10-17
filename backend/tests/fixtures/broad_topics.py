"""Labeled (focus, title, snippet, relevant) rows for broad domestic topics.

The pre-filter is a recall stage: relevant rows must survive it, and noise rows
that share no plan term (including the 'us' + generic-word pattern that leaked
before) must not. Partial-term matches are the rerank's job, not tested here."""

BROAD_TOPICS = [
    ("Data centers and privacy in the US", "Data centers draw scrutiny over residents' privacy", "Local officials question data collection.", True),
    ("Data centers and privacy in the US", "Hyperscale data center plans spark privacy pushback", "Communities object to surveillance.", True),
    ("Data centers and privacy in the US", "New state privacy law targets data brokers", "Legislators pass consumer privacy rules.", True),
    ("Data centers and privacy in the US", "AI data centers strain the power grid", "Utilities warn of demand from data centers.", True),
    ("Data centers and privacy in the US", "US jobs data beat forecasts", "Hiring rose in September.", False),
    ("Data centers and privacy in the US", "What the playoffs mean for us", "Fans react to the final game.", False),
    ("Data centers and privacy in the US", "Celebrity wedding photos released", "Red carpet gallery.", False),
    ("student loans in the us", "Student loan forgiveness ruling expected", "Borrowers await the court decision.", True),
    ("student loans in the us", "Student loans servicers face complaints", "Borrowers report billing errors.", True),
    ("student loans in the us", "Mortgage rates edge higher", "Home buyers face costs.", False),
    ("student loans in the us", "Weather service warns of storms", "Heavy rain expected.", False),
    ("wildfire insurance across the United States", "Insurers retreat from wildfire zones", "Homeowners struggle to find wildfire insurance coverage.", True),
    ("wildfire insurance across the United States", "Wildfire season raises insurance premiums", "Rates climb in western states.", True),
    ("wildfire insurance across the United States", "City council approves new bike lanes", "Construction starts in spring.", False),
    ("wildfire insurance across the United States", "Movie box office weekend results", "A sequel tops the chart.", False),
]
