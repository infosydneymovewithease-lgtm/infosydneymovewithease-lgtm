import { settleStorage, GRACE_DAYS } from './storageBilling.js'

const 单 = (over = {}) => ({
  moveInDate: '2026-11-09', moveOutDate: '2027-02-15',  // 98 天 = 14 周 → 长期
  boxes: 10, furniture: 2, ...over,
})

const 行 = (名, r) => {
  if (!r) return console.log(名.padEnd(26) + '→ null')
  const 结 = r.要退 > 0 ? `退 $${r.要退}` : r.要补 > 0 ? `补 $${r.要补}` : '不退不补'
  console.log(名.padEnd(26) + `${r.档位}  已付 $${r.已付}  应收 $${r.应收}  → ${结}`
    + (r.掉档 ? '  ⚠️掉档' : '') + (r.新到期日 ? '  新到期 ' + r.新到期日 : ''))
}

console.log('━━ 基准：10 箱 + 2 家具，11/09 入库，付到 2027-02-15（14 周 · 长期档）━━')
console.log('   长期价 10×$4 + 2×$8 = $56/周 = $8/天\n')

console.log('── A. 按时取件 ──')
行('正好到期日取',        settleStorage(单({ actualMoveOutDate: '2027-02-15' }), '2027-02-15'))

console.log('\n── B. 提前取件（多退少补）──')
行('提前 2 周取',         settleStorage(单({ actualMoveOutDate: '2027-02-01' }), '2027-02-01'))
行('第 4 周就取（掉档）',  settleStorage(单({ actualMoveOutDate: '2026-12-07', requestedMaterials: { boxes: 10, tape: 2 } }), '2026-12-07'))

console.log('\n── C. 逾期（宽限期边界）──')
for (const d of [0, 1, 29, 30, 31, 60, 183]) {
  const end = new Date('2027-02-15T00:00:00'); end.setDate(end.getDate() + d)
  const s = `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`
  const r = settleStorage(单(), s)
  console.log(`逾期 ${String(d).padStart(3)} 天 (${s})  欠 $${String(r.要补).padStart(8)}   明天再多 $${r.每天多收}`)
}

console.log('\n── D. 逾期后续费 ──')
行('逾期 24 天 + 续 8 周', settleStorage(单(), '2027-03-11', 8))
行('逾期 76 天 + 续 8 周', settleStorage(单(), '2027-05-02', 8))

console.log('\n── E. 短期单续成长期 ──')
行('订 4 周，续 4 周',     settleStorage(单({ moveOutDate: '2026-12-07' }), '2026-12-07', 4))

console.log('\n── F. 明细长什么样（逾期 76 天 + 续 8 周）──')
const r = settleStorage(单(), '2027-05-02', 8)
r.段.forEach(s => console.log(`   ${s.标签.padEnd(14)} ${s.从} → ${s.到}  ${String(s.天).padStart(3)} 天 × $${s.日价}/天 = $${s.金额}`))
console.log(`   ${'已付'.padEnd(14)} -$${r.已付}`)
console.log(`   ${'要补'.padEnd(14)} $${r.要补}`)

// ── G. 2026-11-19 回归：短期客户逾期，【不许升档】 ─────────────────
// 老板 11-19：「预期 30 天内是宽限期没有什么费用变动，
//              超过 1 个月就是按短期寄存费用算的」
// 修之前：客人一逾期，总时长把档位推进长期档，单价 $5 → $4，
//         连前面正常那段都跟着降价，逾期 45 天少收 $33。
const 短期单 = { moveInDate: '2026-11-18', moveOutDate: '2026-12-16', boxes: 4, furniture: 0 }
console.log('\n── G. 短期客户逾期不升档（11-19 修）──')
console.log('   4 箱 · 订 4 周 · 短期档 $5/件/周 = $20/周 = $2.86/天')
let 全对 = true
for (const [日, 逾, 应档, 应补] of [
  ['2026-12-16',   0, '短期',   0.00],
  ['2027-01-15',  30, '短期',  85.71],
  ['2027-01-16',  31, '短期',  88.57],
  ['2027-01-30',  45, '短期', 128.57],
  ['2027-05-16', 151, '短期', 431.43],
]) {
  const r = settleStorage(短期单, 日)
  const ok = r.档位 === 应档 && Math.abs(r.要补 - 应补) < 0.02
  if (!ok) 全对 = false
  console.log(`   逾期 ${String(逾).padStart(3)} 天  档位 ${r.档位}  日价 $${r.日价}  要补 $${String(r.要补).padStart(7)}` +
              `   ${ok ? '对' : `错 ← 应该是 ${应档} / $${应补}`}`)
}
console.log(`\n   G 段结论：${全对 ? '对 —— 拖多久都还是短期档，日价一个数走到底' : '错 —— 还在升档'}`)
