import { supabase } from '../lib/supabase'

// Single source of truth for slot labels per vehicle group.
// These label strings are stored as orders."startTime" in the database.
export const SLOT_CONFIG = {
  van: {
    slots: ['08:00–10:00', '10:30–12:30', '13:00–15:00', '15:30–17:30', '18:00–20:00'],
  },
  small: {
    slots: ['08:00–12:00', '11:30–13:30', '15:30–17:30'],
  },
  large: {
    slots: ['08:00–13:00', '15:00–18:00'],
  },
}

// Fallback capacities used when the vehicles table is empty or RPC fails
const FALLBACK = {
  van:   { slot_capacity: 1, daily_capacity: 5 },
  small: { slot_capacity: 2, daily_capacity: 6 },
  large: { slot_capacity: 1, daily_capacity: 2 },
}

/**
 * Fetch slot availability for a vehicle group + date.
 *
 * Returns a map: { [slotLabel]: { available, slot_capacity, slot_booked,
 *   daily_capacity, daily_booked, capacity (alias), booked (alias) } }
 *
 * Fails open on any error — returns all slots as fully available so the
 * customer can still attempt to book; the server-side RPC is authoritative.
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
      data.map(({ slot, available, slot_capacity, slot_booked, daily_capacity, daily_booked }) => [
        slot, {
          available,
          slot_capacity, slot_booked,
          daily_capacity, daily_booked,
          // backward-compat aliases
          capacity: slot_capacity,
          booked:   slot_booked,
        },
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
  const fb = FALLBACK[vehicleGroup] || { slot_capacity: 1, daily_capacity: 3 }
  return Object.fromEntries(
    config.slots.map(slot => [slot, {
      available:       fb.slot_capacity,
      slot_capacity:   fb.slot_capacity,
      slot_booked:     0,
      daily_capacity:  fb.daily_capacity,
      daily_booked:    0,
      capacity:        fb.slot_capacity,
      booked:          0,
    }])
  )
}
