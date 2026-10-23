// Home cities of the newsroom feeds, for the loading screen's arcs. One HQ per outlet,
// keyed by the collapsed outlet name (backend rss_source.feed_outlets()); aggregators and
// search services have no home city and never draw arcs.
import type { LatLng } from './follow'

// Mirrors _OUTLET_COLLAPSE in backend/ingestion/rss_source.py: section feeds share their outlet's city.
const COLLAPSE: Record<string, string> = {
  'New York Times World': 'New York Times',
  'New York Times U.S.': 'New York Times',
  'New York Times Technology': 'New York Times',
  'NPR World': 'NPR',
  'NPR News': 'NPR',
  'The Guardian World': 'The Guardian',
  'BBC World': 'BBC',
  'CNN World': 'CNN',
  'Fox News World': 'Fox News',
  'ABC News International': 'ABC News',
  'CBS News World': 'CBS News',
  'CNBC Top News': 'CNBC',
}

export const FEED_CITIES: Record<string, [number, number]> = {
  BBC: [51.52, -0.14], // London
  'Al Jazeera': [25.29, 51.53], // Doha
  'The Guardian': [51.53, -0.12], // London
  NPR: [38.9, -77.01], // Washington, DC
  'The Hindu': [13.08, 80.27], // Chennai
  'Deutsche Welle': [50.72, 7.12], // Bonn
  'France 24': [48.82, 2.27], // Paris (Issy-les-Moulineaux)
  AllAfrica: [38.9, -77.04], // Washington, DC; it also has offices in Africa, but its HQ is here
  'Straits Times': [1.29, 103.85], // Singapore
  CNN: [33.76, -84.39], // Atlanta
  'Fox News': [40.76, -73.98], // New York
  'New York Times': [40.76, -73.99], // New York
  'ABC News': [40.77, -73.98], // New York
  'CBS News': [40.77, -73.99], // New York
  Axios: [38.88, -77.1], // Arlington, VA
  Politico: [38.9, -77.07], // Arlington, VA (Rosslyn)
  'The Verge': [40.74, -73.99], // New York
  'Ars Technica': [40.71, -74.01], // New York
  Wired: [37.78, -122.4], // San Francisco
  MarketWatch: [40.71, -74.0], // New York
  CNBC: [40.88, -73.95], // Englewood Cliffs, NJ
  'Investing.com': [32.08, 34.78], // Tel Aviv
  'Financial Times': [51.51, -0.1], // London
}

/** The home city of a newsroom feed (by its feed or outlet name), or null when it has none. */
export function feedCity(name: string): LatLng | null {
  const city = FEED_CITIES[COLLAPSE[name] ?? name]
  return city ? { lat: city[0], lng: city[1] } : null
}
