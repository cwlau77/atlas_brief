// The globe readout's place names: the country a point is in, from world-atlas
// countries-110m (the data the land points come from). Local time is given only for
// single-zone countries; a multi-zone country gets null rather than a guessed time.
// Points off the coarse 110m coastlines, and very small states, name nothing.
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import countries110m from 'world-atlas/countries-110m.json'

type Ring = [number, number][]
type Poly = { name: string; rings: Ring[]; bbox: [number, number, number, number] }

// world-atlas's abbreviated names, as the readout shows them.
const DISPLAY: Record<string, string> = {
  'United States of America': 'United States',
  'Dem. Rep. Congo': 'Democratic Republic of the Congo',
  "Côte d'Ivoire": 'Ivory Coast',
  'Bosnia and Herz.': 'Bosnia',
  Macedonia: 'North Macedonia',
  'S. Sudan': 'South Sudan',
  'Dominican Rep.': 'Dominican Republic',
  'Central African Rep.': 'Central African Republic',
  'Eq. Guinea': 'Equatorial Guinea',
  'Solomon Is.': 'Solomon Islands',
  'Falkland Is.': 'Falkland Islands',
  'W. Sahara': 'Western Sahara',
  'N. Cyprus': 'Northern Cyprus',
  'Fr. S. Antarctic Lands': 'French Southern Lands',
  eSwatini: 'Eswatini',
}

// IANA zone by display name, or null for multi-zone countries. A name missing here also gets null.
const ZONES: Record<string, string | null> = {
  Afghanistan: 'Asia/Kabul', Albania: 'Europe/Tirane', Algeria: 'Africa/Algiers', Angola: 'Africa/Luanda',
  Antarctica: null, Argentina: null, Armenia: 'Asia/Yerevan', Australia: null, Austria: 'Europe/Vienna',
  Azerbaijan: 'Asia/Baku', Bahamas: 'America/Nassau', Bangladesh: 'Asia/Dhaka', Belarus: 'Europe/Minsk',
  Belgium: 'Europe/Brussels', Belize: 'America/Belize', Benin: 'Africa/Porto-Novo', Bhutan: 'Asia/Thimphu',
  Bolivia: 'America/La_Paz', Bosnia: 'Europe/Sarajevo', Botswana: 'Africa/Gaborone', Brazil: null,
  Brunei: 'Asia/Brunei', Bulgaria: 'Europe/Sofia', 'Burkina Faso': 'Africa/Ouagadougou',
  Burundi: 'Africa/Bujumbura', Cambodia: 'Asia/Phnom_Penh', Cameroon: 'Africa/Douala', Canada: null,
  'Central African Republic': 'Africa/Bangui', Chad: 'Africa/Ndjamena', Chile: null, China: 'Asia/Shanghai',
  Colombia: 'America/Bogota', Congo: 'Africa/Brazzaville', 'Costa Rica': 'America/Costa_Rica',
  Croatia: 'Europe/Zagreb', Cuba: 'America/Havana', Cyprus: 'Asia/Nicosia', Czechia: 'Europe/Prague',
  'Democratic Republic of the Congo': null, Denmark: 'Europe/Copenhagen', Djibouti: 'Africa/Djibouti',
  'Dominican Republic': 'America/Santo_Domingo', Ecuador: 'America/Guayaquil', Egypt: 'Africa/Cairo',
  'El Salvador': 'America/El_Salvador', 'Equatorial Guinea': 'Africa/Malabo', Eritrea: 'Africa/Asmara',
  Estonia: 'Europe/Tallinn', Eswatini: 'Africa/Mbabane', Ethiopia: 'Africa/Addis_Ababa',
  'Falkland Islands': 'Atlantic/Stanley', Fiji: 'Pacific/Fiji', Finland: 'Europe/Helsinki',
  France: 'Europe/Paris', 'French Southern Lands': null, Gabon: 'Africa/Libreville', Gambia: 'Africa/Banjul',
  Georgia: 'Asia/Tbilisi', Germany: 'Europe/Berlin', Ghana: 'Africa/Accra', Greece: 'Europe/Athens',
  Greenland: null, Guatemala: 'America/Guatemala', Guinea: 'Africa/Conakry', 'Guinea-Bissau': 'Africa/Bissau',
  Guyana: 'America/Guyana', Haiti: 'America/Port-au-Prince', Honduras: 'America/Tegucigalpa',
  Hungary: 'Europe/Budapest', Iceland: 'Atlantic/Reykjavik', India: 'Asia/Kolkata', Indonesia: null,
  Iran: 'Asia/Tehran', Iraq: 'Asia/Baghdad', Ireland: 'Europe/Dublin', Israel: 'Asia/Jerusalem',
  Italy: 'Europe/Rome', 'Ivory Coast': 'Africa/Abidjan', Jamaica: 'America/Jamaica', Japan: 'Asia/Tokyo',
  Jordan: 'Asia/Amman', Kazakhstan: null, Kenya: 'Africa/Nairobi', Kosovo: 'Europe/Belgrade',
  Kuwait: 'Asia/Kuwait', Kyrgyzstan: 'Asia/Bishkek', Laos: 'Asia/Vientiane', Latvia: 'Europe/Riga',
  Lebanon: 'Asia/Beirut', Lesotho: 'Africa/Maseru', Liberia: 'Africa/Monrovia', Libya: 'Africa/Tripoli',
  Lithuania: 'Europe/Vilnius', Luxembourg: 'Europe/Luxembourg', Madagascar: 'Indian/Antananarivo',
  Malawi: 'Africa/Blantyre', Malaysia: 'Asia/Kuala_Lumpur', Mali: 'Africa/Bamako',
  Mauritania: 'Africa/Nouakchott', Mexico: null, Moldova: 'Europe/Chisinau', Mongolia: null,
  Montenegro: 'Europe/Podgorica', Morocco: 'Africa/Casablanca', Mozambique: 'Africa/Maputo',
  Myanmar: 'Asia/Yangon', Namibia: 'Africa/Windhoek', Nepal: 'Asia/Kathmandu', Netherlands: 'Europe/Amsterdam',
  'New Caledonia': 'Pacific/Noumea', 'New Zealand': 'Pacific/Auckland', Nicaragua: 'America/Managua',
  Niger: 'Africa/Niamey', Nigeria: 'Africa/Lagos', 'North Korea': 'Asia/Pyongyang',
  'North Macedonia': 'Europe/Skopje', 'Northern Cyprus': 'Asia/Famagusta', Norway: 'Europe/Oslo',
  Oman: 'Asia/Muscat', Pakistan: 'Asia/Karachi', Palestine: 'Asia/Gaza', Panama: 'America/Panama',
  'Papua New Guinea': 'Pacific/Port_Moresby', Paraguay: 'America/Asuncion', Peru: 'America/Lima',
  Philippines: 'Asia/Manila', Poland: 'Europe/Warsaw', Portugal: 'Europe/Lisbon',
  'Puerto Rico': 'America/Puerto_Rico', Qatar: 'Asia/Qatar', Romania: 'Europe/Bucharest', Russia: null,
  Rwanda: 'Africa/Kigali', 'Saudi Arabia': 'Asia/Riyadh', Senegal: 'Africa/Dakar', Serbia: 'Europe/Belgrade',
  'Sierra Leone': 'Africa/Freetown', Slovakia: 'Europe/Bratislava', Slovenia: 'Europe/Ljubljana',
  'Solomon Islands': 'Pacific/Guadalcanal', Somalia: 'Africa/Mogadishu', Somaliland: 'Africa/Mogadishu',
  'South Africa': 'Africa/Johannesburg', 'South Korea': 'Asia/Seoul', 'South Sudan': 'Africa/Juba',
  Spain: 'Europe/Madrid', 'Sri Lanka': 'Asia/Colombo', Sudan: 'Africa/Khartoum',
  Suriname: 'America/Paramaribo', Sweden: 'Europe/Stockholm', Switzerland: 'Europe/Zurich',
  Syria: 'Asia/Damascus', Taiwan: 'Asia/Taipei', Tajikistan: 'Asia/Dushanbe', Tanzania: 'Africa/Dar_es_Salaam',
  Thailand: 'Asia/Bangkok', 'Timor-Leste': 'Asia/Dili', Togo: 'Africa/Lome',
  'Trinidad and Tobago': 'America/Port_of_Spain', Tunisia: 'Africa/Tunis', Turkey: 'Europe/Istanbul',
  Turkmenistan: 'Asia/Ashgabat', Uganda: 'Africa/Kampala', Ukraine: 'Europe/Kyiv',
  'United Arab Emirates': 'Asia/Dubai', 'United Kingdom': 'Europe/London', 'United States': null,
  Uruguay: 'America/Montevideo', Uzbekistan: 'Asia/Tashkent', Vanuatu: 'Pacific/Efate',
  Venezuela: 'America/Caracas', Vietnam: 'Asia/Ho_Chi_Minh', 'Western Sahara': 'Africa/El_Aaiun',
  Yemen: 'Asia/Aden', Zambia: 'Africa/Lusaka', Zimbabwe: 'Africa/Harare',
}

let polys: Poly[] | null = null

function load(): Poly[] {
  const topo = countries110m as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>
  const out: Poly[] = []
  for (const f of feature(topo, topo.objects.countries).features) {
    const g = f.geometry
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) continue
    const name = DISPLAY[f.properties.name] ?? f.properties.name
    for (const rings of (g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as Ring[][]) {
      let minX = 180, maxX = -180, minY = 90, maxY = -90
      for (const [x, y] of rings[0]) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x)
        minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      }
      out.push({ name, rings, bbox: [minX, minY, maxX, maxY] })
    }
  }
  return out
}

function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** The country the point is in, with its zone when it has only one; null over sea. */
export function countryAt(lat: number, lng: number): { name: string; timeZone: string | null } | null {
  polys ??= load()
  for (const { name, rings, bbox } of polys) {
    if (lng < bbox[0] || lng > bbox[2] || lat < bbox[1] || lat > bbox[3]) continue
    if (inRing(lng, lat, rings[0]) && !rings.slice(1).some((hole) => inRing(lng, lat, hole))) {
      return { name, timeZone: ZONES[name] ?? null }
    }
  }
  return null
}
