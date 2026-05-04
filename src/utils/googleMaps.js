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
    if (data.error) {
      console.error('[Places API]', data.error.status, data.error.message)
      return []
    }
    return data.suggestions
      ?.map(s => s.placePrediction?.text?.text)
      .filter(Boolean) || []
  } catch (e) {
    console.error('[Places API] fetch error', e)
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
    if (data.error) {
      console.error('[Routes API]', data.error.status, data.error.message)
      return null
    }
    const meters = data.routes?.[0]?.distanceMeters
    if (!meters) return null
    return Math.round(meters / 100) / 10
  } catch (e) {
    console.error('[Routes API] fetch error', e)
    return null
  }
}
