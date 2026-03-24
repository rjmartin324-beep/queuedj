export interface GeoLocation {
  id: string;
  name: string;       // Revealed AFTER guessing
  lat: number;
  lng: number;
  hint: string;       // Vague clue shown during guessing (continent / climate)
  // imageUrl: swap picsum placeholder for a real photo URL later
  // Mapbox satellite: https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lng},${lat},12/800x400?access_token=TOKEN
  imageUrl: string;
}

// picsum.photos/seed/<name>/800/450 → same random photo every time per seed
// Replace with real landmark photos when Mapbox key is ready
const PIC = (seed: string) => `https://picsum.photos/seed/${seed}/800/450`;

export const GEO_LOCATIONS: GeoLocation[] = [
  // ── Europe ──────────────────────────────────────────────────────────────────
  { id: "paris",      name: "Eiffel Tower, Paris",          lat: 48.858,  lng: 2.295,    hint: "Western Europe", imageUrl: PIC("paris") },
  { id: "rome",       name: "Colosseum, Rome",              lat: 41.890,  lng: 12.492,   hint: "Southern Europe", imageUrl: PIC("rome") },
  { id: "london",     name: "Big Ben, London",              lat: 51.501,  lng: -0.124,   hint: "Northern Europe", imageUrl: PIC("london") },
  { id: "barcelona",  name: "Sagrada Família, Barcelona",   lat: 41.404,  lng: 2.174,    hint: "Southern Europe", imageUrl: PIC("barcelona") },
  { id: "athens",     name: "Acropolis, Athens",            lat: 37.971,  lng: 23.726,   hint: "Southern Europe", imageUrl: PIC("athens") },
  { id: "amsterdam",  name: "Canals, Amsterdam",            lat: 52.374,  lng: 4.890,    hint: "Western Europe", imageUrl: PIC("amsterdam") },

  // ── Americas ─────────────────────────────────────────────────────────────────
  { id: "nyc",        name: "Statue of Liberty, New York",  lat: 40.689,  lng: -74.044,  hint: "North America", imageUrl: PIC("newyork") },
  { id: "rio",        name: "Christ the Redeemer, Rio",     lat: -22.952, lng: -43.210,  hint: "South America", imageUrl: PIC("rio") },
  { id: "machu",      name: "Machu Picchu, Peru",           lat: -13.163, lng: -72.545,  hint: "South America", imageUrl: PIC("machu") },
  { id: "chicago",    name: "Chicago, USA",                 lat: 41.878,  lng: -87.630,  hint: "North America", imageUrl: PIC("chicago") },
  { id: "mexico",     name: "Chichen Itza, Mexico",         lat: 20.683,  lng: -88.569,  hint: "Central America", imageUrl: PIC("mexico") },
  { id: "patagonia",  name: "Patagonia, Argentina",         lat: -51.629, lng: -72.700,  hint: "South America", imageUrl: PIC("patagonia") },

  // ── Asia ─────────────────────────────────────────────────────────────────────
  { id: "taj",        name: "Taj Mahal, India",             lat: 27.175,  lng: 78.042,   hint: "South Asia", imageUrl: PIC("tajmahal") },
  { id: "tokyo",      name: "Tokyo, Japan",                 lat: 35.689,  lng: 139.692,  hint: "East Asia", imageUrl: PIC("tokyo") },
  { id: "china",      name: "Great Wall, China",            lat: 40.432,  lng: 116.570,  hint: "East Asia", imageUrl: PIC("greatwall") },
  { id: "dubai",      name: "Burj Khalifa, Dubai",          lat: 25.197,  lng: 55.274,   hint: "Middle East", imageUrl: PIC("dubai") },
  { id: "angkor",     name: "Angkor Wat, Cambodia",         lat: 13.412,  lng: 103.867,  hint: "Southeast Asia", imageUrl: PIC("angkor") },
  { id: "singapore",  name: "Marina Bay, Singapore",        lat: 1.282,   lng: 103.861,  hint: "Southeast Asia", imageUrl: PIC("singapore") },

  // ── Africa ───────────────────────────────────────────────────────────────────
  { id: "pyramids",   name: "Pyramids of Giza, Egypt",      lat: 29.979,  lng: 31.134,   hint: "North Africa", imageUrl: PIC("pyramids") },
  { id: "safari",     name: "Serengeti, Tanzania",          lat: -2.333,  lng: 34.833,   hint: "East Africa", imageUrl: PIC("serengeti") },
  { id: "capetown",   name: "Cape Town, South Africa",      lat: -33.926, lng: 18.424,   hint: "Southern Africa", imageUrl: PIC("capetown") },

  // ── Oceania ──────────────────────────────────────────────────────────────────
  { id: "sydney",     name: "Sydney Opera House",           lat: -33.857, lng: 151.215,  hint: "Oceania", imageUrl: PIC("sydney") },
  { id: "uluru",      name: "Uluru, Australia",             lat: -25.344, lng: 131.036,  hint: "Oceania", imageUrl: PIC("uluru") },
  { id: "newzealand", name: "Milford Sound, New Zealand",   lat: -44.641, lng: 167.900,  hint: "Oceania", imageUrl: PIC("newzealand") },

  // ── Wildcards ─────────────────────────────────────────────────────────────────
  { id: "iceland",    name: "Northern Lights, Iceland",     lat: 64.963,  lng: -19.021,  hint: "North Atlantic", imageUrl: PIC("iceland") },
  { id: "maldives",   name: "Maldives",                     lat: 3.202,   lng: 73.221,   hint: "Indian Ocean", imageUrl: PIC("maldives") },
  { id: "alaska",     name: "Denali, Alaska",               lat: 63.069,  lng: -151.007, hint: "North America", imageUrl: PIC("alaska") },
  { id: "antarctica", name: "Antarctica",                   lat: -82.863, lng: -135.000, hint: "Very cold",  imageUrl: PIC("antarctica") },
];
