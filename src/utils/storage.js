// 寄存单状态 —— 唯一口径
//
// 2026-11-16 新建。起因是小洁在群里说的：
//   「还没有开始寄存的，标记为"待入库"／正在寄存的，标记为"寄存中"／
//     寄存逾期的，标记为"待出库"」
//   「这些还没开始寄存呢，没到取货时间 —— 哦，但是我在这里看不出来」
//
// ⚠️ 原来 StorageList 和 StorageDetail 各写了一份 getStorageStatus()，
//    两份都【只看出库日】，从头到尾没碰过 moveInDate 和 status。后果：
//      · 入库日还没到的 5 单，全被标成「寄存中」—— 小洁圈红的就是这些
//      · 已取消的单也混在列表里，照样显示「寄存中」
//
// ⚠️ 为什么用 workerStatus === 'done' 而不是「入库日到了没」：
//    师傅交单那一刻东西才真进仓。客户临时改期、师傅晚一天到，
//    按日期算就错了，按交单算不会错。arrivedAt 也是那时候写的。

import dayjs from 'dayjs'

// ── 催费节奏（老板 2026-11-16 定）─────────────────────────
//   出库日 −15 天  第一封：问续费还是取货
//   出库日 − 7 天  第二封：再催 + 把逾期规则讲全
//   逾期 0~1 个月  按原价继续计费（纸箱 $4/周 · 家具 $8/周）
//   逾期 1~2 个月  涨到短期价（纸箱 $5/周 · 家具 $10/周）
//   逾期 2 个月以上 处理 / 变卖抵扣仓储费
export const FIRST_NOTICE_DAYS  = 15
export const SECOND_NOTICE_DAYS = 7

/**
 * @returns {{key, label, color, daysLeft}} key 用来做筛选，label 用来显示
 */
export function storageStatus(order, now = dayjs()) {
  if (order?.status === '已取消')
    return { key: 'cancelled', label: '已取消', color: 'bg-gray-100 text-gray-400' }

  if (order?.actualMoveOutDate)
    return { key: 'done', label: '已取件', color: 'bg-gray-100 text-gray-500' }

  // 师傅还没交单 = 东西还没进库
  if (order?.workerStatus !== 'done')
    return { key: 'pending', label: '待入库', color: 'bg-indigo-100 text-indigo-700' }

  const daysLeft = dayjs(order.moveOutDate).diff(now, 'day')
  if (daysLeft < 0)
    return { key: 'overdue', label: `已逾期 ${-daysLeft} 天`, color: 'bg-red-100 text-red-600', daysLeft }

  // ⚠️ 老板 11-16 定的催费节奏：提前 15 天催一次，提前 7 天再催一次并把规则讲全。
  //    所以「即将到期」的窗口是 15 天，不是原来的 7 天 ——
  //    7 天才提醒，客户来不及约车、排时间，容易直接拖成逾期。
  if (daysLeft <= FIRST_NOTICE_DAYS)
    return {
      key: 'expiring',
      label: `${daysLeft}天后到期`,
      // 进了第二封（7 天）的窗口就转橙，客服一眼看得出哪几单该加紧
      color: daysLeft <= SECOND_NOTICE_DAYS
        ? 'bg-orange-100 text-orange-700'
        : 'bg-amber-100 text-amber-700',
      daysLeft,
      urgent: daysLeft <= SECOND_NOTICE_DAYS,
    }
  return { key: 'active', label: '寄存中', color: 'bg-green-100 text-green-700', daysLeft }
}

/** 列表页的筛选页签。顺序就是界面顺序。 */
export const STORAGE_TABS = [
  { label: '全部',     value: 'all' },
  { label: '待入库',   value: 'pending' },
  { label: '寄存中',   value: 'active' },
  { label: '即将到期', value: 'expiring' },
  { label: '待出库',   value: 'overdue' },
  { label: '已取件',   value: 'done' },
]
