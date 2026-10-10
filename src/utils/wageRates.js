// 工资费率解析 —— 从数据库 staff_rate 取，按订单日期匹配当时生效的那条
//
// 2026-10-11 第 2 步。原本费率硬编码在 WageRecords.jsx 的 WORKERS 常量里，
// 两个后果：① 名单漏了老周，他 278.5 小时从没在工资页出现过
//           ② 每次招人、调价都要改代码重新部署
//
// 为什么要按日期匹配：小宇 2026-08-01 起从 $30 涨到 $31。
// 如果只存一个当前值，改完之后打开 7 月的工资页会拿 $31 去乘 7 月的工时 ——
// 历史工资被追溯改写，对账就失去意义。

// ── 回退用的旧名单 ──────────────────────────────────────────
// ⚠️ 只在数据库读不到时兜底（迁移未跑、RPC 报错、网络问题）。
// 不要在这里加新人 —— 新人加到 staff_rate 表里。
const LEGACY_RATES = {
  laomou:    { name: '老木', hourlyRate: 33, isDriver: false },
  xiaoyu:    { name: '小宇', hourlyRate: 30, isDriver: false },
  chenxi:    { name: '晨曦', hourlyRate: 33, isDriver: true  },
  laowang:   { name: '老王', hourlyRate: 33, isDriver: true  },
  xiaozhang: { name: '小张', hourlyRate: 33, isDriver: true  },
}

const LEGACY_DRIVER_RATES = {
  '大卡车': 40, '大卡三人': 40,
  '小卡车': 37, '小卡三人': 37, '卡车单人': 37,
  '面包车': 34, '双卡车': 37,
}

const DEFAULT_RATE = 33

/**
 * 取某人在某一天生效的费率。
 * @param {Array}  staffRates  list_staff_rates() 的结果
 * @param {string} staffId
 * @param {string} onDate      'YYYY-MM-DD'，缺省则取最新一条
 * @returns {{name, hourlyRate, isDriver, driverRates, active, source}}
 *          source: 'db' | 'legacy' | 'default' —— 页面上可以据此提示「费率未录入」
 */
export function resolveRate(staffRates, staffId, onDate) {
  const rows = (staffRates || [])
    .filter(r => r.staff_id === staffId)
    .filter(r => !onDate || String(r.effective_from) <= onDate)
    .sort((a, b) => String(b.effective_from).localeCompare(String(a.effective_from)))

  if (rows.length > 0) {
    const r = rows[0]
    return {
      name:        r.name || staffId,
      hourlyRate:  Number(r.hourly_rate),
      isDriver:    !!r.is_driver,
      driverRates: r.driver_rates || LEGACY_DRIVER_RATES,
      active:      r.active !== false,
      source:      'db',
    }
  }

  const legacy = LEGACY_RATES[staffId]
  if (legacy) {
    return { ...legacy, driverRates: LEGACY_DRIVER_RATES, active: true, source: 'legacy' }
  }

  // 完全不认识的人 —— 这正是老周遇到的情况，以前会静默按 33 算
  return {
    name: staffId, hourlyRate: DEFAULT_RATE, isDriver: false,
    driverRates: LEGACY_DRIVER_RATES, active: true, source: 'default',
  }
}

/**
 * 某人在某一单上的实际时薪。
 * 只有担任该单司机（order.assignedTo === staffId）且有车型加成时才用加成价。
 */
export function hourlyRateFor(staffRates, staffId, order) {
  const r = resolveRate(staffRates, staffId, order?.date)
  const isDriverRole = order?.assignedTo === staffId
  const rate = (r.isDriver && isDriverRole && order?.vehicle)
    ? (r.driverRates?.[order.vehicle] ?? r.hourlyRate)
    : r.hourlyRate
  return { ...r, rate, isDriverRole }
}

/**
 * 这批订单里真正参与过的人（按参与单数降序）。
 * 取代原来「遍历硬编码 WORKERS 常量」的做法 ——
 * 那样做名单外的人（老周）永远不会出现在工资页上。
 */
export function participantsIn(orders) {
  const count = new Map()
  for (const o of orders || []) {
    const ids = new Set([...(o.assignedWorkers || []), ...(o.assignedTo ? [o.assignedTo] : [])])
    for (const id of ids) count.set(id, (count.get(id) || 0) + 1)
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
}
