// Region-name -> [lat, lng] centroids for globe plotting. The backend returns
// free-text region names from the synthesis model, so this table covers the
// countries and supranational regions that model realistically emits. Names
// that resolve to nothing are skipped on the globe — never guessed.

const CENTROIDS: Record<string, [number, number]> = {
  // — countries (major news emitters) —
  afghanistan: [33.9, 67.7], albania: [41.2, 20.2], algeria: [28.0, 1.7],
  angola: [-11.2, 17.9], argentina: [-38.4, -63.6], armenia: [40.1, 45.0],
  australia: [-25.3, 133.8], austria: [47.5, 14.6], azerbaijan: [40.1, 47.6],
  bangladesh: [23.7, 90.4], belarus: [53.7, 27.9], belgium: [50.5, 4.5],
  bolivia: [-16.3, -63.6], bosnia: [43.9, 17.7], brazil: [-14.2, -51.9],
  bulgaria: [42.7, 25.5], 'burkina faso': [12.2, -1.6], myanmar: [21.9, 95.9],
  burma: [21.9, 95.9], cambodia: [12.6, 105.0], cameroon: [7.4, 12.4],
  canada: [56.1, -106.3], chad: [15.5, 18.7], chile: [-35.7, -71.5],
  china: [35.9, 104.2], colombia: [4.6, -74.3], congo: [-4.0, 21.8],
  'democratic republic of the congo': [-4.0, 21.8], drc: [-4.0, 21.8],
  'costa rica': [9.7, -83.8], croatia: [45.1, 15.2], cuba: [21.5, -77.8],
  cyprus: [35.1, 33.4], czechia: [49.8, 15.5], 'czech republic': [49.8, 15.5],
  denmark: [56.3, 9.5], ecuador: [-1.8, -78.2], egypt: [26.8, 30.8],
  'el salvador': [13.8, -88.9], eritrea: [15.2, 39.8], estonia: [58.6, 25.0],
  ethiopia: [9.1, 40.5], finland: [61.9, 25.7], france: [46.2, 2.2],
  georgia: [42.3, 43.4], germany: [51.2, 10.5], ghana: [7.9, -1.0],
  greece: [39.1, 21.8], guatemala: [15.8, -90.2], guinea: [9.9, -9.7],
  haiti: [19.0, -72.3], honduras: [15.2, -86.2], hungary: [47.2, 19.5],
  iceland: [64.9, -19.0], india: [20.6, 79.0], indonesia: [-0.8, 113.9],
  iran: [32.4, 53.7], iraq: [33.2, 43.7], ireland: [53.4, -8.2],
  israel: [31.0, 34.9], italy: [41.9, 12.6], 'ivory coast': [7.5, -5.5],
  jamaica: [18.1, -77.3], japan: [36.2, 138.3], jordan: [30.6, 36.2],
  kazakhstan: [48.0, 66.9], kenya: [-0.02, 37.9], kosovo: [42.6, 20.9],
  kuwait: [29.3, 47.5], kyrgyzstan: [41.2, 74.8], laos: [19.9, 102.5],
  latvia: [56.9, 24.6], lebanon: [33.9, 35.9], libya: [26.3, 17.2],
  lithuania: [55.2, 23.9], madagascar: [-18.8, 47.0], malawi: [-13.3, 34.3],
  malaysia: [4.2, 101.9], mali: [17.6, -4.0], mauritania: [21.0, -10.9],
  mexico: [23.6, -102.6], moldova: [47.4, 28.4], mongolia: [46.9, 103.8],
  montenegro: [42.7, 19.4], morocco: [31.8, -7.1], mozambique: [-18.7, 35.5],
  namibia: [-22.6, 18.5], nepal: [28.4, 84.1], netherlands: [52.1, 5.3],
  'new zealand': [-40.9, 174.9], nicaragua: [12.9, -85.2], niger: [17.6, 8.1],
  nigeria: [9.1, 8.7], 'north korea': [40.3, 127.5], 'north macedonia': [41.6, 21.7],
  norway: [60.5, 8.5], oman: [21.5, 55.9], pakistan: [30.4, 69.3],
  palestine: [31.9, 35.2], panama: [8.5, -80.8], 'papua new guinea': [-6.3, 143.9],
  paraguay: [-23.4, -58.4], peru: [-9.2, -75.0], philippines: [12.9, 121.8],
  poland: [51.9, 19.1], portugal: [39.4, -8.2], qatar: [25.4, 51.2],
  romania: [45.9, 25.0], russia: [61.5, 105.3], rwanda: [-1.9, 29.9],
  'saudi arabia': [23.9, 45.1], senegal: [14.5, -14.5], serbia: [44.0, 21.0],
  'sierra leone': [8.5, -11.8], singapore: [1.35, 103.8], slovakia: [48.7, 19.7],
  slovenia: [46.2, 15.0], somalia: [5.2, 46.2], 'south africa': [-30.6, 22.9],
  'south korea': [35.9, 127.8], 'south sudan': [6.9, 31.3], spain: [40.5, -3.7],
  'sri lanka': [7.9, 80.8], sudan: [12.9, 30.2], sweden: [60.1, 18.6],
  switzerland: [46.8, 8.2], syria: [34.8, 38.997], taiwan: [23.7, 121.0],
  tajikistan: [38.9, 71.3], tanzania: [-6.4, 34.9], thailand: [15.9, 101.0],
  tunisia: [33.9, 9.5], turkey: [39.0, 35.2], turkmenistan: [38.97, 59.6],
  uganda: [1.4, 32.3], ukraine: [48.4, 31.2], 'united arab emirates': [23.4, 53.8],
  uae: [23.4, 53.8], 'united kingdom': [55.4, -3.4], uk: [55.4, -3.4],
  britain: [55.4, -3.4], 'united states': [37.1, -95.7], usa: [37.1, -95.7],
  us: [37.1, -95.7], america: [37.1, -95.7], uruguay: [-32.5, -55.8],
  uzbekistan: [41.4, 64.6], venezuela: [6.4, -66.6], vietnam: [14.1, 108.3],
  yemen: [15.6, 48.5], zambia: [-13.1, 27.8], zimbabwe: [-19.0, 29.2],

  // — supranational regions & theaters the synthesis model emits —
  'middle east': [29.3, 42.6], 'south china sea': [13.8, 114.3], sahel: [14.5, 2.0],
  'horn of africa': [8.0, 46.0], 'south asia': [23.0, 80.0], 'southeast asia': [7.0, 110.0],
  'east asia': [35.0, 115.0], 'central asia': [43.0, 63.0], 'eastern europe': [51.0, 28.0],
  'western europe': [48.0, 5.0], europe: [50.0, 12.0], 'north africa': [28.0, 12.0],
  'west africa': [11.0, -2.0], 'east africa': [0.0, 37.0], 'sub-saharan africa': [2.0, 20.0],
  africa: [2.0, 20.0], 'latin america': [-10.0, -65.0], 'south america': [-15.0, -60.0],
  'central america': [12.5, -87.0], 'north america': [45.0, -100.0], caribbean: [18.5, -70.0],
  'indo-pacific': [0.0, 130.0], asia: [30.0, 95.0], 'asia-pacific': [10.0, 130.0],
  arctic: [78.0, 20.0], 'persian gulf': [26.5, 51.5], 'red sea': [19.0, 39.0],
  balkans: [42.5, 21.0], 'korean peninsula': [38.0, 127.5], 'taiwan strait': [24.3, 119.5],
  'european union': [50.0, 9.0], eu: [50.0, 9.0], gaza: [31.4, 34.4],
  'west bank': [31.9, 35.3], kashmir: [34.0, 76.0], 'black sea': [43.5, 34.0],
  'strait of hormuz': [26.6, 56.5], mediterranean: [36.0, 18.0], 'baltic sea': [58.0, 20.0],
  nato: [50.0, 9.0], 'global south': [0.0, 20.0],
}

// Longest-first so "eastern europe" resolves before "europe" on substring pass.
const KEYS_BY_LENGTH = Object.keys(CENTROIDS).sort((a, b) => b.length - a.length)

export interface GeoPoint {
  lat: number
  lng: number
}

export function resolveRegion(name: string): GeoPoint | null {
  const key = name.trim().toLowerCase()
  if (!key) return null
  const direct = CENTROIDS[key]
  if (direct) return { lat: direct[0], lng: direct[1] }
  // "northern Nigeria", "US-China relations" → longest contained known name.
  // Guard with word boundaries so "usa" never matches inside "sausage".
  for (const candidate of KEYS_BY_LENGTH) {
    const idx = key.indexOf(candidate)
    if (idx === -1) continue
    const before = idx === 0 ? '' : key[idx - 1]
    const after = key[idx + candidate.length] ?? ''
    if (/[a-z0-9]/.test(before) || /[a-z0-9]/.test(after)) continue
    const [lat, lng] = CENTROIDS[candidate]
    return { lat, lng }
  }
  return null
}
