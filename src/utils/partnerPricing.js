import { VEHICLES } from '../data/vehicles'

// 合作客户车型定价：partner.pricing = { [vehicleKey]: { hourlyRate, returnFee } }
// 只存覆盖项；未覆盖的车型回退标准价（B3：标准价仍在 vehicles.js）。
const has = v => v != null && v !== '' && !Number.isNaN(Number(v))

// 返回某客户某车型的实际单价 { hourlyRate, returnFee, isCustom }
export function effectiveVehicleRate(partner, vehicleKey) {
  const std = VEHICLES[vehicleKey] || {}
  const o = partner?.pricing?.[vehicleKey]
  const customHourly = o && has(o.hourlyRate)
  const customReturn = o && has(o.returnFee)
  return {
    hourlyRate: customHourly ? Number(o.hourlyRate) : std.hourlyRate,
    returnFee:  customReturn ? Number(o.returnFee)  : std.returnFee,
    isCustom:   !!(customHourly || customReturn),
  }
}
