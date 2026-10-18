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
import { sydneyDateOf } from './date'

/** 某天该开放哪几段休息。单人日自动砍掉 single_day=false 的那段。 */
export function slotsForDay(breakWindows, staffSchedules, dateStr, now = new Date(), roster) {
  const season = currentSeason(now)
  const ids = [...new Set((staffSchedules || []).map(s => s.staff_id))]
  const onDuty = ids.filter(id => isWorkingOn(staffSchedules, id, dateStr, roster))
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

/**
 * 这个号归谁管。
 *
 * 老板 10-18：新运营 Lili 接手小红书之后，小红书的私信只落在她手机上。
 * 小洁的日报上却还列着「小红书·迁喜 待填」—— 她根本没法填，
 * 要么空着交不了日报，要么瞎填一个数。瞎填的数比没有更糟。
 *
 * ⚠️ owner_staff_id 为空＝没指定＝谁都要登记（维持线上原来的行为）。
 *    微信那两个号就是空的 —— 两个客服共用一个微信，谁在岗谁登记。
 */
export function ownsAccount(account, staffId, seeAll) {
  if (seeAll || !staffId) return true          // 不传人＝全看（团队视图、老板）
  if (!account?.owner_staff_id) return true    // 没指定负责人＝公共的
  return account.owner_staff_id === staffId
}

/** 我这张登记表上该出现哪些号（含「计划中」的，灰显不必填）。 */
export function myChannels(channelAccounts, staffId, seeAll) {
  return (channelAccounts || [])
    .filter(a => ownsAccount(a, staffId, seeAll))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
}

/** 每天必须登记的账号（status='active'）。planned 的灰显不必填。 */
export function requiredAccounts(channelAccounts, staffId, seeAll) {
  return myChannels(channelAccounts, staffId, seeAll).filter(a => a.status === 'active')
}

/**
 * 平台咨询登记完成度。
 * ⚠️ 判断依据是「这个账号今天有没有登记过」，不是「人数大于 0」——
 *    今天 0 个咨询也是有效登记，不能逼人填个假数字。
 */
export function inquiryProgress(channelAccounts, inquiries, dateStr, staffId, seeAll) {
  // ⚠️ 这里必须跟着归属走 —— 不然小洁的日报会卡在「还差小红书没登记」，
  //    而那个数她看不到。闸门卡的必须是她做得到的事。
  const need = requiredAccounts(channelAccounts, staffId, seeAll)
  // staffId 给了就只看这个人填的 —— 老板 10-12：「有时候是两个人，需要知道各自」
  const mine = (inquiries || []).filter(i =>
    String(i.log_date) === dateStr && (!staffId || i.staff_id === staffId))
  const done = new Set(mine.map(i => i.account_id))
  const missing = need.filter(a => !done.has(a.id))
  const total = mine.reduce((s, i) => s + (Number(i.count) || 0), 0)
  return { need, missing, filled: need.length - missing.length, total, ok: missing.length === 0 }
}

/** 某天每个人各接待了多少。两人在岗时各填各的，合计是相加。 */
export function inquiryByStaff(inquiries, dateStr) {
  const by = new Map()
  for (const i of inquiries || []) {
    if (String(i.log_date) !== dateStr) continue
    const cur = by.get(i.staff_id) || { staff_id: i.staff_id, total: 0, accounts: 0 }
    by.set(i.staff_id, { ...cur, total: cur.total + (Number(i.count) || 0), accounts: cur.accounts + 1 })
  }
  return [...by.values()].sort((a, b) => b.total - a.total)
}

/**
 * 今日业绩 —— 系统自动算，不用人填。
 *
 * ⚠️ 「我今天建了几单」必须按【建单时刻】算，不是服务日期。
 *    实测 368 单里 88% 不是当天搬的（中位间隔 2 天）——
 *    按服务日期算的话，客服今天接的单绝大多数都不算数。
 *    第一版我写错了，老板 10-12 指出来的。
 *
 * 两个数分开给，因为是两回事：
 *   booked   我今天接了几单（她今天的产出）
 *   served   今天搬家且我建的单（那天的活，可能是上周接的）
 */
export function myPerformance(orders, staffId, dateStr) {
  const booked = (orders || []).filter(o =>
    o.createdBy === staffId && sydneyDateOf(o.createdAt) === dateStr && o.status !== '已取消')
  const served = (orders || []).filter(o =>
    o.createdBy === staffId && String(o.date) === dateStr && o.status === '已完成')
  return {
    booked: booked.length,
    bookedAmount: booked.reduce((s, o) => s + (Number(o.finalAmount) || Number(o.quote) || 0), 0),
    served: served.length,
    servedAmount: served.reduce((s, o) => s + (Number(o.finalAmount) || 0), 0),
  }
}

/** 某天建的单（全公司）—— 漏斗的分子。咨询和建单是同一天的事，成交是几天后。 */
export function bookedOn(orders, dateStr) {
  return (orders || []).filter(o => sydneyDateOf(o.createdAt) === dateStr && o.status !== '已取消')
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

/**
 * 同一天两个人的登记互相对照。
 *
 * 老板 10-12 指出的：「填写都是自己账号登录的人填写，本身就可以分辨出来
 * 填写数据不同，可以在统计一面看出两个人的差异」
 *
 * 这个信号比「数字看着不像真的」那几个硬得多 ——
 * 它不靠猜，而是【两个独立来源对同一件事的报告不一致】。
 * 两人同一天在岗、看的是同样的平台，数字差太远就只有两种可能：
 * 一个人没去看那个号，或者另一个人报多了。两种都该问一句。
 */
export function crossCheck(inquiries, dateStr, accounts, nameOf = x => x) {
  const byStaff = {}
  for (const i of inquiries || []) {
    if (String(i.log_date) !== dateStr) continue
    ;(byStaff[i.staff_id] ||= {})[i.account_id] = Number(i.count) || 0
  }
  const ids = Object.keys(byStaff)
  if (ids.length < 2) return []          // 单人日没有对照，不出信号

  const out = []
  for (const a of accounts || []) {
    const vals = ids.map(id => ({ id, v: byStaff[id][a.id] }))
    const filled = vals.filter(x => x.v !== undefined)
    if (filled.length < 2) continue
    const nums = filled.map(x => x.v)
    const lo = Math.min(...nums), hi = Math.max(...nums)
    // 一个报 0 另一个报 >=5，或者高的是低的 4 倍以上且差 >=5
    if ((lo === 0 && hi >= 5) || (lo > 0 && hi >= lo * 4 && hi - lo >= 5)) {
      const names = filled.map(x => `${nameOf(x.id)} ${x.v}`).join(' / ')
      out.push({ sev: 'mid', account: a.name,
        text: `${a.name}：${names} —— 同一天同一个号，差这么多值得问一句` })
    }
  }
  return out
}

export function trustSignals({ today, yesterday, clockIn, orderCount, accounts, nameOf }) {
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

  // ⑥ 同日两人互相对照 —— 最硬的一个信号，放最后但权重最高
  out.push(...crossCheck(today, today[0] && String(today[0].log_date), accounts, nameOf))
  return out
}


/** 主动开发的动作选项。老板 10-13 定：必填且要能量化。 */
export const OUTREACH_ACTIONS = ['发租房群', '回访老客', '发名片', '同行/中介', '其他']

/**
 * 主动开发填完整了吗。
 * ⚠️ 判断依据是「选了动作」而不是「带来好友 > 0」——
 *    今天出去发了名片一个没加到，也是做了工作，不该因为结果不好就算没填。
 *    把「有没有做」和「做得怎么样」分开，才不会逼人编数字。
 */
export function outreachDone(log) {
  return !!(log?.outreach_actions?.length)
}
