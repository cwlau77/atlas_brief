// chart.js only matters once a briefing exists — keep it out of the entry chunk.
// Shared by BriefingView (lazy render) and App (idle preload).
export const loadAnalytics = () => import('../components/AnalyticsPanel')
export const preloadAnalytics = () => { void loadAnalytics() }
