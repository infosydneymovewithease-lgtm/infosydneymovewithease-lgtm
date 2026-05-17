// 寄存费率 — 全系统唯一来源
// 避免散在 5 个页面里硬编码，调价只改这里。
//
// 规则：
//   ≤ 5 周：纸箱 $5/件/周，家具 $10/件/周
//   > 5 周：纸箱 $4/件/周，家具 $8/件/周  + 免费送纸箱/胶带/家具保护膜
// 按订单"最终"总周数判断（短期延长成长期 → 整单按长期价重算）。

export const STORAGE_RATES = {
  short: { boxRate: 5, furRate: 10 },  // ≤5 周
  long:  { boxRate: 4, furRate: 8  },  // >5 周
}

export const FREE_SUPPLIES_LABEL = '纸箱 · 胶带 · 家具保护膜'

export function getStorageRates(weeks) {
  const shortTerm = weeks <= 5
  const rates = shortTerm ? STORAGE_RATES.short : STORAGE_RATES.long
  return {
    boxRate: rates.boxRate,
    furRate: rates.furRate,
    shortTerm,
    freeSupplies: !shortTerm,
  }
}
