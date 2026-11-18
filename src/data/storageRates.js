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

// ── 物资（老板 2026-11-19 定稿）──────────────────────────────
// 11-17 一度改成「只送纸箱，胶带 $3 / 床垫套 $10」。
// 11-19 老板推翻：「不用管，因为可以送，这个价格。
//                   但是前提是提前和我们说，我们师傅会带过去」
//
// 所以三样照送，真正的前提不是钱，是【提前告知】——
// 师傅出车前才知道要带几个箱子；到了现场临时要，车上没有。
// 页面文案要说的是这一句，不是价目表。
export const MATERIAL_PRICES = { boxes: 5, tape: 3, mattressCover: 10 }
export const MATERIAL_LABELS = { boxes: '纸箱', tape: '胶带', mattressCover: '床垫套' }

/** 长期客户（>5 周）免费提供的物资 */
export const FREE_SUPPLIES_LABEL = '纸箱 · 胶带 · 家具保护膜'

/** 跟在免费项后面的前提条件 —— 这才是客户要记住的那句 */
export const SUPPLIES_NOTICE = '请提前告知数量，师傅当天带过去'

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
