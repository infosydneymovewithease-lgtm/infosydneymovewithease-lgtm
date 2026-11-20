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
import { getStorageRates } from '../data/storageRates'

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

/**
 * 师傅端推进寄存单某一步时要写的字段 —— 【全系统唯一一份】。
 *
 * ⚠️ 2026-11-21 抽出来的。老板：「为什么不像搬家订单一样点击一下就进入下一个流程」。
 *    搬家单在首页卡片上就有「确认收单」按钮，一键推进；
 *    寄存单只有详情页的步骤条里有，必须点进去翻下来才能确认。
 *    要在卡片上也加按钮，规则就会出现在两个地方 ——
 *    而「同一条规则写两遍然后不一致」正是寄存板块这一串毛病的来源
 *    （寄存费一度有三个版本、返程费两边不一样）。所以先抽成一份。
 *
 * 状态推进用【反着判断】：只要不是终态就推到「已确认」，不去猜起始值是什么。
 * 线上寄存单的起始状态至少三种（待确认 / 已收定金 / 已派单），白名单一定会漏。
 */
export function storageStepUpdates(order, stepKey) {
  const updates = { workerStatus: stepKey }
  if (stepKey === 'arrived') updates.arrivedAt = new Date().toISOString()
  if (['confirmed', 'arrived'].includes(stepKey)
      && !['寄存中', '已取消', '已确认'].includes(order?.status)) {
    updates.status = '已确认'
    updates.confirmedAt = order?.confirmedAt || new Date().toISOString()
  }
  return updates
}

/**
 * 单张寄存单的仓储费（不含运输）—— 全系统唯一一份。
 * ⚠️ 不读 totalFee / weeklyFee：规则文档第十节说明那两列是脏字段，
 *    和按价目表算出来的对不上。唯一真相是「件数 × 周数 × 价目表」。
 */
/**
 * 单张寄存单【每周】多少钱 —— 和 storageFeeOf 同源，只差没乘周数。
 * ⚠️ 档位按 order.weeks 判断，不按 moveOut−moveIn 推算。
 *    老板 11-10：「客人付款 9 周的钱，不能改动就不正确」—— 付了几周才是事实。
 */
export function weeklyFeeOf(order) {
  const weeks = Math.max(1, Number(order?.weeks) || 1)
  const { boxRate, furRate } = getStorageRates(weeks)
  return (Number(order?.boxes) || 0) * boxRate + (Number(order?.furniture) || 0) * furRate
}

export function storageFeeOf(order) {
  const weeks = Math.max(1, Number(order?.weeks) || 1)
  const { boxRate, furRate } = getStorageRates(weeks)
  const v = ((Number(order?.boxes) || 0) * boxRate
           + (Number(order?.furniture) || 0) * furRate) * weeks
  return Math.round(v * 100) / 100   // r2 是别处函数里的局部变量，这里用不到
}

