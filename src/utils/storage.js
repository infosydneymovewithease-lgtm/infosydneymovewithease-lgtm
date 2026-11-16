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
    return { key: 'overdue', label: '待出库', color: 'bg-red-100 text-red-600', daysLeft }
  if (daysLeft <= 7)
    return { key: 'expiring', label: `${daysLeft}天后到期`, color: 'bg-amber-100 text-amber-700', daysLeft }
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
