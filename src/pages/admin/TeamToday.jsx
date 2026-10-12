// 客服工作台 · 团队视图（Annie 看的）—— 2026-10-12 第 5 步
//
// 和「我的日报」读同一份数据（get_workday），差别只在展示方式。
// ⚠️ 绝不做两套查询 —— 那是数字对不上的开始。
//
// Annie 要在这一页看到四件事：
//   谁交了日报 · 今天的咨询→成单漏斗 · 本周视频出了没 · 哪些事要她处理

import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { sydneyToday, addDays } from '../../utils/date'
import { slotsForDay, breakMinutes, requiredAccounts, weekRange, trustSignals } from '../../utils/worklog'
import { isWorkingOn } from '../../utils/shifts'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'

const hhmm = iso => iso
  ? new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  : '—'
const WEEK = ['一', '二', '三', '四', '五', '六', '日']

export default function TeamToday() {
  const { staff, orders, config, getWorkday, getInquiryWeek } = useApp()
  const [date, setDate] = useState(() => sydneyToday())
  const [day, setDay] = useState({ logs: [], breaks: [], inquiries: [], posts: [] })
  const [week, setWeek] = useState([])
  const [prevDay, setPrevDay] = useState([])

  const wk = useMemo(() => weekRange(date), [date])
  useEffect(() => {
    let alive = true
    ;(async () => {
      const [d, w, p] = await Promise.all([
        getWorkday(date), getInquiryWeek(wk.from, wk.to), getWorkday(addDays(date, -1))])
      if (alive) { setDay(d); setWeek(w); setPrevDay(p.inquiries || []) }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, wk.from, wk.to])

  // 今天该上班的人
  const onDuty = useMemo(() => {
    const ids = [...new Set((config.staffSchedules || []).map(s => s.staff_id))]
    return ids.filter(id => isWorkingOn(config.staffSchedules, id, date))
  }, [config.staffSchedules, date])

  const slots = slotsForDay(config.breakWindows, config.staffSchedules, date)
  const accounts = requiredAccounts(config.channelAccounts)

  // 今日漏斗：咨询 → 成单
  const inquiries = day.inquiries.reduce((s, i) => s + (Number(i.count) || 0), 0)
  const dayOrders = orders.filter(o => String(o.date) === date)
  const rate = inquiries > 0 ? (dayOrders.length / inquiries * 100) : null

  // 本周视频
  const weekPosts = day.posts
  const videoThisWeek = weekPosts.filter(p => p.kind === 'video').length

  // 要 Annie 处理的
  const todo = []
  for (const id of onDuty) {
    const l = day.logs.find(x => x.staff_id === id)
    const name = staff.find(s => s.id === id)?.name || id
    if (!l?.clock_in) todo.push({ sev: 'mid', text: `${name} 还没打上班卡` })
    else if (!l?.submitted_at) todo.push({ sev: 'mid', text: `${name} 的日报还没提交` })
    if (l?.issues) todo.push({ sev: 'high', text: `${name} 提了问题：${l.issues}` })
  }
  if (slots.length && videoThisWeek === 0) todo.push({ sev: 'mid', text: '本周还没出视频 —— 目标每周至少 1 条' })

  // 咨询登记的可信度信号。⚠️ 只在这里显示，客服自己那页不提示 ——
  // 提示了等于教她怎么绕过。而且这些是「看起来不像真实数据」，不是证据。
  const trust = trustSignals({
    today: day.inquiries, yesterday: prevDay,
    clockIn: day.logs.find(l => onDuty.includes(l.staff_id))?.clock_in,
    orderCount: dayOrders.length,
  })

  return (
    <div className="p-5 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">团队今日</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            今天 {onDuty.length} 人在岗{onDuty.length <= 1 && ' · 单人日，不排下午休息'}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-white rounded-xl shadow-sm p-1">
          <button onClick={() => setDate(addDays(date, -1))} className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg"><ChevronLeft size={18} /></button>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-2 py-1 text-sm font-semibold outline-none" />
          <button onClick={() => setDate(addDays(date, 1))} className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg"><ChevronRight size={18} /></button>
        </div>
      </div>

      {/* ── 要处理的 ─────────────────────────── */}
      {todo.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold text-sm mb-2">需要你处理</h2>
          <div className="space-y-1">
            {todo.map((t, i) => (
              <p key={i} className={`text-sm ${t.sev === 'high' ? 'text-red-600' : 'text-amber-600'}`}>
                {t.sev === 'high' ? '🔴' : '🟠'} {t.text}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ── 出勤与错峰 ───────────────────────── */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h2 className="font-bold text-sm mb-1">出勤与错峰休息</h2>
        <p className="text-xs text-gray-400 mb-3">
          两人错开是业务要求 —— 同时休息就没人看平台，而客人正在等回复
        </p>
        {onDuty.map(id => {
          const l = day.logs.find(x => x.staff_id === id)
          const who = staff.find(s => s.id === id)
          return (
            <div key={id} className="py-2 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-3 flex-wrap text-sm">
                <span className="font-semibold w-20 shrink-0">{who?.name || id}</span>
                <span className="text-gray-500 font-mono text-xs">
                  上班 {hhmm(l?.clock_in)} · 下班 {hhmm(l?.clock_out)}
                </span>
                <span className="flex-1" />
                {l?.submitted_at
                  ? <span className="text-xs text-green-600 flex items-center gap-1"><Check size={12} />日报已交</span>
                  : <span className="text-xs text-gray-400">日报未交</span>}
              </div>
              <div className="flex gap-2 mt-1.5 flex-wrap">
                {slots.map(w => {
                  const r = day.breaks.find(b => b.staff_id === id && b.slot_index === w.slot_index)
                  const on = r?.started_at && !r?.ended_at
                  const mins = breakMinutes(r)
                  const over = r?.overtime || (on && mins > (w.duration_min || 60))
                  return (
                    <span key={w.slot_index}
                      className={`text-xs px-2 py-0.5 rounded ${
                        over ? 'bg-red-100 text-red-700 font-semibold'
                        : on ? 'bg-amber-100 text-amber-700'
                        : r ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      {w.slot_name}
                      {r ? ` ${hhmm(r.started_at)}${r.ended_at ? `–${hhmm(r.ended_at)} ${r.minutes}分` : ' 休息中'}` : ' 未休'}
                      {over && ' 超时'}
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
        {onDuty.length === 0 && <p className="text-sm text-gray-400">今天没人排班</p>}
      </div>

      {trust.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-amber-200">
          <h2 className="font-bold text-sm mb-1">咨询登记 · 看着不太对的地方</h2>
          <p className="text-xs text-gray-400 mb-2">
            这些是「不像真实数据」的信号，<b>不是证据</b> —— 真实情况也可能碰巧触发。
            值得问一句，不值得当成结论。客服那边看不到这一块。
          </p>
          <div className="space-y-1">
            {trust.map((s, i) => <p key={i} className="text-sm text-amber-700">· {s.text}</p>)}
          </div>
        </div>
      )}

      {/* ── 今日漏斗 ─────────────────────────── */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h2 className="font-bold text-sm mb-3">今日漏斗</h2>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="平台咨询" value={`${inquiries} 人`} />
          <Stat label="成单" value={`${dayOrders.length} 单`} />
          <Stat label="转化率" value={rate == null ? '—' : `${rate.toFixed(0)}%`}
            hint={rate == null ? '还没登记咨询' : null} />
        </div>
      </div>

      {/* ── 账号 × 星期 ──────────────────────── */}
      <div className="bg-white rounded-2xl p-4 shadow-sm overflow-x-auto">
        <h2 className="font-bold text-sm mb-1">本周平台咨询</h2>
        <p className="text-xs text-gray-400 mb-3">{wk.from} ~ {wk.to} · 漏登记的格子标红</p>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-xs font-medium text-gray-400 pb-2 pr-3">账号</th>
              {WEEK.map((d, i) => <th key={i} className="text-xs font-medium text-gray-400 pb-2 px-1 w-10">{d}</th>)}
              <th className="text-xs font-medium text-gray-400 pb-2 pl-2">周计</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(a => {
              const cells = WEEK.map((_, i) => {
                const d = addDays(wk.from, i)
                const rec = week.find(w => w.account_id === a.id && String(w.log_date) === d)
                return { d, rec, future: d > sydneyToday() }
              })
              const sum = cells.reduce((s, c) => s + (Number(c.rec?.count) || 0), 0)
              return (
                <tr key={a.id}>
                  <td className="pr-3 py-1 font-semibold text-xs whitespace-nowrap">{a.name}</td>
                  {cells.map((c, i) => (
                    <td key={i} className="px-1 py-1 text-center">
                      {c.rec ? <span className="font-mono text-sm">{c.rec.count}</span>
                        : c.future ? <span className="text-gray-200">·</span>
                        : <span className="text-xs text-red-600 font-semibold">漏</span>}
                    </td>
                  ))}
                  <td className="pl-2 font-mono font-bold text-sm text-right">{sum}</td>
                </tr>
              )
            })}
            <tr className="border-t border-gray-100">
              <td className="pr-3 pt-2 text-xs text-gray-400">每日合计</td>
              {WEEK.map((_, i) => {
                const d = addDays(wk.from, i)
                const s = week.filter(w => String(w.log_date) === d).reduce((x, w) => x + (Number(w.count) || 0), 0)
                return <td key={i} className="px-1 pt-2 text-center font-mono text-xs text-gray-500">{s || '—'}</td>
              })}
              <td className="pl-2 pt-2 font-mono font-bold text-sm text-right">
                {week.reduce((s, w) => s + (Number(w.count) || 0), 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── 本周发布 ─────────────────────────── */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h2 className="font-bold text-sm mb-1">今日发布</h2>
        <p className={`text-xs mb-3 ${videoThisWeek ? 'text-gray-400' : 'text-amber-600 font-medium'}`}>
          {videoThisWeek ? `今天 ${videoThisWeek} 条视频` : '⚠️ 今天还没出视频 —— 目标每周至少 1 条'}
        </p>
        {weekPosts.length === 0
          ? <p className="text-sm text-gray-400">今天还没登记发布内容</p>
          : weekPosts.map(p => {
              const a = (config.channelAccounts || []).find(x => x.id === p.account_id)
              return (
                <div key={p.id} className="flex items-center gap-2 text-sm py-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                    p.kind === 'video' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {p.kind === 'video' ? '视频' : '图文'}
                  </span>
                  <span className="font-semibold text-xs w-16 shrink-0">{a?.name || p.account_id}</span>
                  <span className="text-gray-600 flex-1 truncate">{p.title || '（没写标题）'}</span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {staff.find(s => s.id === p.posted_by)?.name || p.posted_by}
                  </span>
                </div>
              )
            })}
      </div>
    </div>
  )
}

function Stat({ label, value, hint }) {
  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-mono font-bold text-lg mt-0.5 text-gray-800">{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  )
}
