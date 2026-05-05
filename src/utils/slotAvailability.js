import { supabase } from '../lib/supabase'

// Single source of truth for slot labels + capacity per vehicle group.
// These label strings are stored as orders."startTime" in the database.
export const SLOT_CONFIG = {
  van: {
    slots:    ['08:00–10:00', '10:30–12:30', '13:00–15:00', '15:30–17:30', '18:00–20:00'],
    capacity: 1,
  },
  small: {
    slots:    ['08:00–12:00', '11:30–13:30', '15:30–17:30'],
    capacity: 2,
  },
  large: {
    slots:    ['08:00–13:00', '15:00–18:00'],
    capacity: 1,
  },
}

/**
 * Fetch slot availability for a vehicle group + date.
 *
 * Returns a map: { [slotLabel]: { capacity, booked, available } }
 *
 * Fails open on any error — returns all slots as fully available so the
 * customer can still attempt to book; the server-side RPC provides the
 * authoritative check.
 */
export async function fetchSlotsAvailability(vehicleGroup, date) {
  const config = SLOT_CONFIG[vehicleGroup]
  if (!config || !date) return buildFallback(vehicleGroup)

  try {
    const { data, error } = await supabase.rpc('get_slots_availability', {
      p_vehicle_group: vehicleGroup,
      p_date:          date,
      p_slots:         config.slots,
    })

    if (error || !Array.isArray(data)) {
      console.warn('[slots] RPC error, failing open:', error?.message)
      return buildFallback(vehicleGroup)
    }

    return Object.fromEntries(
      data.map(({ slot, capacity, booked, available }) => [
        slot, { capacity, booked, available },
      ])
    )
  } catch (err) {
    console.warn('[slots] Network error, failing open:', err)
    return buildFallback(vehicleGroup)
  }
}

function buildFallback(vehicleGroup) {
  const config = SLOT_CONFIG[vehicleGroup]
  if (!config) return {}
  return Object.fromEntries(
    config.slots.map(slot => [slot, { capacity: config.capacity, booked: 0, available: config.capacity }])
  )
}
