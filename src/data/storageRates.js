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

// ── 物资（老板 2026-11-17 定）────────────────────────────────
// ⚠️ 物资【不是自动送的】，是按需提供、用多少算多少。
//    「有的客人需要有的客人不需要，没有用我们就不能收这个费用」
//    —— 老板原话。在这之前所有页面都写「含免费物资」，
//    出现在每一张长期单上，但实际上很多单一个箱子都没给。
//
// 长期客户（>5 周）：纸箱免费，按实际发放数量算，没给就不算
// 其余一律按单价收：
export const MATERIAL_PRICES = { boxes: 5, tape: 3, mattressCover: 10 }
export const MATERIAL_LABELS = { boxes: '纸箱', tape: '胶带', mattressCover: '床垫套' }

/** 长期客户免费的那一项 */
export const FREE_SUPPLIES_LABEL = '纸箱'

/** 收费物资的说明，跟在免费项后面 */
export const PAID_SUPPLIES_NOTE = '胶带 $3/个 · 床垫套 $10/个'

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
