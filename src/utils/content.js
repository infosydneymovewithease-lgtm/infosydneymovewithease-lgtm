// 内容排期 —— 纯逻辑，不碰 React 也不碰 Supabase
//
// 2026-10-14 第 7 步。老板的要求：
//   「整个月的计划每个账号每周发几个每天发那个账号发几条都安排好，
//     经理打开就是知道要编辑那些内容，客服这里就是今天要发布的直接复制发布」
//
// 这里最核心的概念是【一条内容发到多个号】：
//   迁喜文案 → 迁喜号（原文）+ 朋友圈（一字不改复刻）
//   盼达文案 → 盼达号（原文）+ 朋友圈（改写版，经理提前改好）
//   视频     → 视频号（原文）+ 朋友圈（转发）
// 所以朋友圈 7 条一条都不用新写，真正要产出的只有 6 条文案 + 2 个视频。

export const SOURCE_LABEL = {
  original: '原文',
  clone:    '复刻',
  rewrite:  '改写',
  repost:   '转发',
}

// 复刻/转发直接用原文；改写要经理另写一版
export const NEEDS_OVERRIDE = 'rewrite'

/**
 * 这条内容算不算「做好了」。
 *
 * 老板 10-15：「我们有一个素材群，就是微信里，图片要上传吗，
 *              倒是可以上传一张封面图片」
 * 原来要求把所有图传进系统，那是重复搬运 ——
 *   师傅发到素材群 → 佳慧存下来传系统 → 小洁再下载 → 传小红书
 *   中间两趟白跑，小洁直接去群里存最快。
 *
 * 所以图文只要：正文 + 封面图 + 素材在群里哪儿。
 * ⚠️ 视频仍然要求上传文件 —— 群里的视频会过期，
 *    而视频 2–4 小时才出一条，重拍代价和图片完全不是一回事。
 */
export function itemReady(item) {
  if (!item) return false
  if (!String(item.body || '').trim()) return false
  if (item.kind === 'video') {
    return Array.isArray(item.materials) && item.materials.length > 0
  }
  const hasCover = !!(item.cover?.url || item.cover?.data)
  const hasWhere = !!String(item.material_note || '').trim()
  // 全都传进系统了也算做好（她想传就随她）
  const hasMat = Array.isArray(item.materials) && item.materials.length > 0
  return (hasCover && hasWhere) || hasMat
}

/**
 * 格子的状态。
 * ⚠️ 不存在数据库里 —— 存了就要和 item 的变化同步，迟早对不上。
 * empty 没内容 → draft 内容没做好/改写版没写 → ready 小洁能发了 → posted / skipped
 */
export function slotStatus(slot, item) {
  if (slot.posted_at)  return 'posted'
  if (slot.skipped_at) return 'skipped'
  if (!slot.item_id)   return 'empty'
  if (!itemReady(item)) return 'draft'
  // 改写版没写，小洁打开会没东西可复制
  if (slot.source_type === NEEDS_OVERRIDE && !String(slot.body_override || '').trim()) return 'draft'
  return 'ready'
}

export const STATUS_LABEL = {
  empty: '空', draft: '草稿', ready: '待发', posted: '已发', skipped: '已跳过',
}

/** 小洁在这个格子上要复制的正文 —— 改写版优先 */
export function bodyFor(slot, item) {
  if (slot.source_type === NEEDS_OVERRIDE && String(slot.body_override || '').trim()) {
    return slot.body_override
  }
  const body = item?.body || ''
  // 复刻到朋友圈时去掉话题标签 —— 朋友圈用不上 #xxx，贴过去很怪
  if (slot.source_type === 'clone' || slot.source_type === 'repost') {
    return body.split('\n').filter(l => !/^\s*#\S/.test(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim()
  }
  return body
}

/** 本周网格：按账号分行，周一到周日分列 */
export function weekGrid(slots, items, monday, accounts) {
  const byId = new Map((items || []).map(i => [i.id, i]))
  const days = Array.from({ length: 7 }, (_, i) => addDaysLocal(monday, i))
  const accIds = [...new Set((slots || []).map(s => s.account_id))]
  const ordered = (accounts || []).map(a => a.id).filter(id => accIds.includes(id))
  for (const id of accIds) if (!ordered.includes(id)) ordered.push(id)

  return ordered.map(accountId => ({
    accountId,
    cells: days.map(date => {
      const inDay = (slots || []).filter(s => s.slot_date === date && s.account_id === accountId)
      return {
        date,
        slots: inDay.map(s => ({ ...s, item: byId.get(s.item_id) || null,
                                 status: slotStatus(s, byId.get(s.item_id)) })),
      }
    }),
  }))
}

/** 本周统计 —— 顶部那排数字 */
export function weekStats(slots, items) {
  const byId = new Map((items || []).map(i => [i.id, i]))
  const st = s => slotStatus(s, byId.get(s.item_id))
  const all = slots || []
  const originals = all.filter(s => s.source_type === 'original')
  // 要新写的＝原创格子里还没就绪的内容条数（按 item 去重，没 item 的算 1 条）
  const need = new Set()
  let needBlank = 0
  for (const s of originals) {
    if (s.posted_at || s.skipped_at) continue
    if (!s.item_id) { needBlank++; continue }
    if (!itemReady(byId.get(s.item_id))) need.add(s.item_id)
  }
  return {
    total:   all.length,
    ready:   all.filter(s => ['ready', 'posted'].includes(st(s))).length,
    posted:  all.filter(s => s.posted_at).length,
    skipped: all.filter(s => s.skipped_at).length,
    reused:  all.filter(s => s.source_type !== 'original').length,
    todo:    need.size + needBlank,
    videos:  all.filter(s => s.kind === 'video' && s.source_type === 'original'),
  }
}

/**
 * 要经理处理的事。按紧急程度排。
 * ⚠️ 只列【做得了】的 —— 已发、已跳过的不再出现，
 *    否则列表越积越长，两周后她就不看了。
 */
export function scheduleTodos(slots, items, today, accountName) {
  const byId = new Map((items || []).map(i => [i.id, i]))
  const out = []
  for (const s of (slots || [])) {
    if (s.posted_at || s.skipped_at) continue
    const item = byId.get(s.item_id)
    const status = slotStatus(s, item)
    if (status === 'ready') continue
    const who = accountName ? accountName(s.account_id) : s.account_id
    const over = s.due_date && s.due_date < today
    const due  = s.due_date === today

    if (status === 'empty') {
      out.push({ sev: over ? 'high' : due ? 'high' : 'mid', slotId: s.id, date: s.slot_date,
        text: `${s.slot_date} ${who} 格子还是空的${over ? '（已过准备截止日）' : due ? '（今天是准备截止日）' : ''}` })
    } else if (s.source_type === NEEDS_OVERRIDE) {
      out.push({ sev: over || due ? 'high' : 'mid', slotId: s.id, date: s.slot_date,
        text: `${s.slot_date} ${who} 的改写版还没写 —— 小洁发的时候会没东西可复制` })
    } else {
      const what = !String(item?.body || '').trim() ? '正文还没写'
        : (item?.materials?.length ? '' : (s.kind === 'video' ? '视频素材还没传' : '图片还没传'))
      out.push({ sev: over || due ? 'high' : 'mid', slotId: s.id, date: s.slot_date,
        text: `${s.slot_date} ${who} ${what || '还没做完'}${over ? '（已过准备截止日）' : due ? '（今天是准备截止日）' : ''}` })
    }
  }
  const rank = { high: 0, mid: 1, low: 2 }
  return out.sort((a, b) => rank[a.sev] - rank[b.sev] || a.date.localeCompare(b.date))
}

/** 小洁今天要发的 —— 只给「待发」，草稿和素材没齐的不显示 */
export function todayToPost(slots, items, date) {
  const byId = new Map((items || []).map(i => [i.id, i]))
  return (slots || [])
    .filter(s => s.slot_date === date)
    .map(s => ({ ...s, item: byId.get(s.item_id) || null, status: slotStatus(s, byId.get(s.item_id)) }))
    .filter(s => ['ready', 'posted'].includes(s.status))
    .sort((a, b) => (a.posted_at ? 1 : 0) - (b.posted_at ? 1 : 0))
}

/** 月视图：每周 × 每账号的计划 vs 实际 */
export function monthMatrix(slots, rules, monthStr) {
  const inMonth = (slots || []).filter(s => s.slot_date.startsWith(monthStr))
  const weeks = [...new Set(inMonth.map(s => mondayOf(s.slot_date)))].sort()
  const accIds = [...new Set((rules || []).map(r => r.account_id))]
  const planPerWeek = id => (rules || [])
    .filter(r => r.account_id === id && r.active !== false)
    .reduce((n, r) => n + (r.weekdays?.length || 0), 0)

  return {
    weeks,
    rows: accIds.map(id => ({
      accountId: id,
      plan: planPerWeek(id),
      cells: weeks.map(mon => {
        const wkEnd = addDaysLocal(mon, 6)
        const inWk = inMonth.filter(s => s.account_id === id && s.slot_date >= mon && s.slot_date <= wkEnd)
        return { monday: mon, done: inWk.filter(s => s.posted_at).length, planned: inWk.length }
      }),
    })),
  }
}

// ── 小工具 ──────────────────────────────────────────────────
export function addDaysLocal(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}

export function mondayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = (dt.getUTCDay() + 6) % 7
  return addDaysLocal(dateStr, -dow)
}
