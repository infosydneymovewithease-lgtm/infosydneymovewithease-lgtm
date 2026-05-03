const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

// Places Autocomplete (New) — Australian addresses
export async function autocompleteAddress(input) {
  if (!input || input.length < 3 || !KEY) return []
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': KEY,
      },
      body: JSON.stringify({
        input,
        includedRegionCodes: ['au'],
        languageCode: 'en',
      }),
    })
    const data = await res.json()
    return data.suggestions
      ?.map(s => s.placePrediction?.text?.text)
      .filter(Boolean) || []
  } catch {
    return []
  }
}

// Routes API — driving distance in km (1 decimal)
export async function getDistanceKm(origin, destination) {
  if (!origin || !destination || !KEY) return null
  try {
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': KEY,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
      },
      body: JSON.stringify({
        origin: { address: origin },
        destination: { address: destination },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_UNAWARE',
      }),
    })
    const data = await res.json()
    const meters = data.routes?.[0]?.distanceMeters
    if (!meters) return null
    return Math.round(meters / 100) / 10
  } catch {
    return null
  }
}
