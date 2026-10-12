// 客服工作台 —— 出勤 / 餐休 / 平台咨询登记（2026-10-12 第 5 步）
//
// 三条业务规则决定了这里的设计：
//
// 1「两人必须错开休息」—— 这是业务要求不是礼貌。
//    同时休息 = 没人看 7 个平台，而客人正在小红书/微信里等回复。
//    但设计稿同样写明【只提示不阻止】——特殊情况总会有，卡死人不如让人看见。
//
// 2「7 个触点一定要每天逐个检查登记」——
//    没登记完不让提交日报。未开通的号也列出来，一直在眼前就不会被忘掉。
//
// 3「单人日不排下午休息」——
//    只有一个人在岗，休 3 小时没人接电话。老板 10-11 定：单人日只休 2 小时。

import { currentSeason, toMinutes, toHHMM, isWorkingOn } from './shifts'

/** 某天该开放哪几段休息。单人日自动砍掉 single_day=false 的那段。 */
export function slotsForDay(breakWindows, staffSchedules, dateStr, now = new Date()) {
  const season = currentSeason(now)
  const ids = [...new Set((staffSchedules || []).map(s => s.staff_id))]
  const onDuty = ids.filter(id => isWorkingOn(staffSchedules, id, dateStr))
  const alone = onDuty.length <= 1
  return (breakWindows || [])
    .filter(w => w.season === season)
    .filter(w => !alone || w.single_day)
    .sort((a, b) => a.slot_index - b.slot_index)
    .map(w => ({ ...w, alone }))
}

/** 窗口内可选的起点（半小时一跳）。用来显示「哪些时段还空着」。 */
export function startOptions(win) {
  const from = toMinutes(win.window_start)
  const to = toMinutes(win.window_end)
  const dur = win.duration_min || 60
  const out = []
  for (let m = from; m + dur <= to; m += 30) out.push(toHHMM(m))
  return out
}

/** 这一刻有没有别人在休息。只用来提示，不用来拦人。 */
export function othersOnBreak(breaks, myStaffId, now = Date.now()) {
  return (breaks || []).filter(b =>
    b.staff_id !== myStaffId &&
    b.started_at && !b.ended_at &&
    new Date(b.started_at).getTime() <= now)
}

/** 我在某一段的休息记录 */
export function myBreak(breaks, staffId, slotIndex) {
  return (breaks || []).find(b => b.staff_id === staffId && b.slot_index === slotIndex)
}

/** 休息超时了吗（分钟）。只提醒，不阻止。 */
export function breakMinutes(rec, now = Date.now()) {
  if (!rec?.started_at) return 0
  const end = rec.ended_at ? new Date(rec.ended_at).getTime() : now
  return Math.max(0, Math.round((end - new Date(rec.started_at).getTime()) / 60000))
}

/** 每天必须登记的账号（status='active'）。planned 的灰显不必填。 */
export function requiredAccounts(channelAccounts) {
  return (channelAccounts || [])
    .filter(a => a.status === 'active')
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
}

/**
 * 平台咨询登记完成度。
 * ⚠️ 判断依据是「这个账号今天有没有登记过」，不是「人数大于 0」——
 *    今天 0 个咨询也是有效登记，不能逼人填个假数字。
 */
export function inquiryProgress(channelAccounts, inquiries, dateStr) {
  const need = requiredAccounts(channelAccounts)
  const done = new Set((inquiries || [])
    .filter(i => String(i.log_date) === dateStr)
    .map(i => i.account_id))
  const missing = need.filter(a => !done.has(a.id))
  const total = (inquiries || [])
    .filter(i => String(i.log_date) === dateStr && done.has(i.account_id))
    .reduce((s, i) => s + (Number(i.count) || 0), 0)
  return { need, missing, filled: need.length - missing.length, total, ok: missing.length === 0 }
}

/** 今日业绩 —— 系统自动算，不用人填。按建单人统计。 */
export function myPerformance(orders, staffId, dateStr) {
  const mine = (orders || []).filter(o => o.createdBy === staffId && String(o.date) === dateStr)
  const done = mine.filter(o => o.status === '已完成')
  return {
    created: mine.length,
    completed: done.length,
    amount: done.reduce((s, o) => s + (Number(o.finalAmount) || 0), 0),
  }
}

/** 本周视频出了没 —— 老板 10-11：运营每周最少保证出一个视频 */
export function weeklyVideo(posts, fromDate, toDate) {
  const inRange = (posts || []).filter(p => String(p.post_date) >= fromDate && String(p.post_date) <= toDate)
  return {
    video: inRange.filter(p => p.kind === 'video').length,
    image: inRange.filter(p => p.kind !== 'video').length,
    ok: inRange.some(p => p.kind === 'video'),
  }
}

/** 本周一 ~ 周日（按悉尼日期字符串算，不碰时区） */
export function weekRange(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = (dt.getUTCDay() + 6) % 7   // 0=周一
  const from = new Date(dt); from.setUTCDate(from.getUTCDate() - dow)
  const to = new Date(from); to.setUTCDate(to.getUTCDate() + 6)
  const f = x => x.toISOString().slice(0, 10)
  return { from: f(from), to: f(to) }
}


// ════════════════════════════════════════════════════════════
// 咨询登记的可信度信号
// ════════════════════════════════════════════════════════════
// 老板 10-12：「我是客服，晚上我很累，我想随便填写糊弄一下就好」
//
// ⚠️ 先说清楚：这个数【无法验证】。咨询发生在微信和小红书里，
//    系统看不见。下面这些只是「看起来不像真实数据」的信号，
//    不是证据 —— 真实情况也可能碰巧触发。所以用词是「可能」，
//    而且只给 Annie 看，不给客服看（提示了等于教她怎么绕过）。
//
// 更根本的一条写在这里提醒以后的人：
//   如果咨询数不参与考核，客服就没有造假的动机。
//   这个数的用途是「看哪个平台有流量」，不是「看谁努力」。
//   一旦拿它考核，再多的检测也挡不住。

/** 几秒之内填完算「没去平台看」的阈值 */
export const FILL_TOO_FAST_SECONDS = 60

export function trustSignals({ today, yesterday, clockIn, orderCount }) {
  const out = []
  const vals = (today || []).map(i => Number(i.count) || 0)
  if (vals.length < 2) return out

  // ① 几个账号填了同一个非零数字 —— 真实流量不会这么整齐
  const nonZero = vals.filter(v => v > 0)
  if (nonZero.length >= 3 && new Set(nonZero).size === 1) {
    out.push({ sev: 'mid', text: `${nonZero.length} 个账号都填了同一个数字 ${nonZero[0]}` })
  }

  // ② 和昨天一模一样
  if (yesterday?.length === today.length && today.length > 0) {
    const a = Object.fromEntries(today.map(i => [i.account_id, Number(i.count) || 0]))
    const b = Object.fromEntries(yesterday.map(i => [i.account_id, Number(i.count) || 0]))
    if (Object.keys(a).every(k => a[k] === b[k])) {
      out.push({ sev: 'mid', text: '每个账号的数字和昨天完全一样' })
    }
  }

  // ③ 全部在一分钟内填完
  const times = today.map(i => i.first_filled_at && new Date(i.first_filled_at).getTime()).filter(Boolean)
  if (times.length >= 3) {
    const span = (Math.max(...times) - Math.min(...times)) / 1000
    if (span < FILL_TOO_FAST_SECONDS) {
      out.push({ sev: 'mid', text: `${times.length} 个账号在 ${Math.round(span)} 秒内全部填完` })
    }
  }

  // ④ 下班前一口气补的（上班后 10 小时以上才第一次填）
  if (clockIn && times.length) {
    const hrs = (Math.min(...times) - new Date(clockIn).getTime()) / 3600000
    if (hrs > 10) out.push({ sev: 'low', text: `上班 ${hrs.toFixed(0)} 小时后才第一次登记，像是下班前补的` })
  }

  // ⑤ 咨询和成单严重背离
  const total = vals.reduce((s, v) => s + v, 0)
  if (total >= 15 && orderCount === 0) {
    out.push({ sev: 'low', text: `登记了 ${total} 个咨询但一单没成` })
  }
  if (total === 0 && orderCount > 0) {
    out.push({ sev: 'low', text: `成了 ${orderCount} 单，但咨询登记全是 0` })
  }
  return out
}
