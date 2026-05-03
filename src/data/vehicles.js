export const VEHICLES = {
  '面包车':   { label: '面包车 (1人)',   hourlyRate: 60,  minHours: 1, returnFee: 50,  overtimeHalf: 30,   people: 1 },
  '卡车单人': { label: '卡车单人 (1人)', hourlyRate: 80,  minHours: 1, returnFee: 80,  overtimeHalf: 40,   people: 1 },
  '小卡车':   { label: '小卡车 (2人)',   hourlyRate: 110, minHours: 2, returnFee: 110, overtimeHalf: 55,   people: 2 },
  '小卡三人': { label: '小卡车 (3人)',   hourlyRate: 160, minHours: 2, returnFee: 160, overtimeHalf: 80,   people: 3 },
  '大卡车':   { label: '大卡车 (2人)',   hourlyRate: 120, minHours: 2, returnFee: 120, overtimeHalf: 60,   people: 2 },
  '大卡三人': { label: '大卡车 (3人)',   hourlyRate: 165, minHours: 2, returnFee: 165, overtimeHalf: 82.5, people: 3 },
  '双卡车':   { label: '双卡车 (4人)',   hourlyRate: 220, minHours: 2, returnFee: 220, overtimeHalf: 110,  people: 4 },
}

// 楼梯费：每层每次一次性收费
export const STAIRS_FEE = { 1: 15, 2: 20, 3: 30, 4: 40 }

// 重物费选项
export const HEAVY_ITEMS = [
  { id: 'fridge_lift',   name: '双开门冰箱（有电梯）', fixed: 50 },
  { id: 'fridge_stairs', name: '双开门冰箱（无电梯）', fixed: 100 },
  { id: 'piano',         name: '立式钢琴',             fixed: null, min: 240, max: 300 },
  { id: 'marble',        name: '大理石',               fixed: null, min: 60,  max: 90  },
]
