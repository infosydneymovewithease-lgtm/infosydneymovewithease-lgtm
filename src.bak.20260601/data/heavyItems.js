// 重物 / 大件附加费 — 14 项标准选项
// 客服派单填金额 → 师傅端自动同步 → 师傅可现场调整
// 价格全部人工填写（不预设固定价），原因：每件物品大小重量差异大
export const HEAVY_ITEM_OPTIONS = [
  { id: 'safeBox',            name: '保险箱' },
  { id: 'piano',              name: '钢琴' },
  { id: 'treadmill',          name: '跑步机' },
  { id: 'massageChair',       name: '按摩椅' },
  { id: 'commercialPrinter',  name: '商用打印机' },
  { id: 'commercialFreezer',  name: '商用冰柜' },
  { id: 'marble',             name: '大理石制品' },
  { id: 'glassFragile',       name: '玻璃易碎品' },
  { id: 'otherFragile',       name: '其他易碎品' },
  { id: 'solidWoodFurniture', name: '实木家具' },
  { id: 'threeDoorWardrobe',  name: '三门实木衣柜' },
  { id: 'doubleDoorFridge',   name: '双开门冰箱' },
  { id: 'mahjongMachine',     name: '麻将机' },
]

// 计算重物费总额（金额 + 其他重物的金额）
export function calcHeavyTotal(heavyItems) {
  if (!heavyItems) return 0
  let total = 0
  for (const id of Object.keys(heavyItems)) {
    if (id === 'other') {
      total += Number(heavyItems.other?.amount) || 0
    } else {
      total += Number(heavyItems[id]) || 0
    }
  }
  return total
}
