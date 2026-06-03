import { VEHICLES } from '../data/vehicles'

export const DISTANCE_TIERS = [
  { min: 0,   max: 30,  type: 'standard', label: '标准范围 ≤30km',     returnHours: 0,    fuelMin: 0,    fuelMax: 0,    needsConfirm: false },
  { min: 30,  max: 50,  type: 'near',     label: '近郊 30–50km',       returnHours: 0.5,  fuelMin: 30,   fuelMax: 30,   needsConfirm: false },
  { min: 50,  max: 70,  type: 'far',      label: '远郊 50–70km',       returnHours: 1,    fuelMin: 60,   fuelMax: 60,   needsConfirm: false },
  { min: 70,  max: 120, type: 'long',     label: '长途 70–120km',      returnHours: 2,    fuelMin: 100,  fuelMax: 100,  needsConfirm: false },
  { min: 120, max: 260, type: 'veryLong', label: '超长途 120–220km',   returnHours: 3,    fuelMin: 180,  fuelMax: 250,  needsConfirm: true  },
  { min: 260, max: 320, type: 'canberra', label: '堪培拉 260–300km',   returnHours: 4,    fuelMin: 350,  fuelMax: 450,  needsConfirm: true  },
  { min: 320, max: Infinity, type: 'special', label: '特殊长途 >300km', returnHours: null, fuelMin: null, fuelMax: null, needsConfirm: true  },
]

export const SPECIAL_DESTINATIONS = [
  { name: 'Coffs Harbour', minPrice: 2800, maxPrice: 3500 },
  { name: 'Brisbane',      minPrice: 3800, maxPrice: 4800 },
  { name: 'Melbourne',     minPrice: null, maxPrice: null, note: '人工确认' },
]

export function getDistanceTier(km) {
  if (!km || km <= 0) return DISTANCE_TIERS[0]
  return DISTANCE_TIERS.find(t => km > t.min && km <= t.max) || DISTANCE_TIERS[DISTANCE_TIERS.length - 1]
}

export function calcRemoteSurcharge(km, vehicleKey) {
  const tier = getDistanceTier(km)
  if (!tier || tier.type === 'standard') return { returnFee: 0, fuelFee: 0, total: 0, tier }
  if (tier.type === 'special') return { returnFee: 0, fuelFee: 0, total: 0, tier, isSpecial: true }
  const v = VEHICLES[vehicleKey]
  if (!v) return { returnFee: 0, fuelFee: 0, total: 0, tier }
  const returnFee = tier.returnHours * v.hourlyRate
  const fuelFee = Math.round((tier.fuelMin + tier.fuelMax) / 2)
  return { returnFee, fuelFee, total: returnFee + fuelFee, tier }
}
