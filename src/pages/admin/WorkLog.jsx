// 客服工作台 · 我的日报 —— 2026-10-12 第 5 步
//
// 客服每天填这一页；Annie 的团队视图读同一份数据。
// 只填一次，两处都能用 —— 绝不做两套查询，那是数字对不上的开始。
//
// 真正要动手写的只有三项：发布内容 / 主动开发 / 问题。
// 出勤点一下，业绩系统自己算，平台咨询填个数字。

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { sydneyToday } from '../../utils/date'
import { currentSeason, tzGapHours } from '../../utils/shifts'
import {
  slotsForDay, startOptions, othersOnBreak, myBreak, breakMinutes,
  requiredAccounts, inquiryProgress, myPerformance, weeklyVideo, weekRange,
} from '../../utils/worklog'
import { LogIn, LogOut, Coffee, Plus, Trash2, Check } from 'lucide-react'

const hhmm = iso => iso
  ? new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  : '—'
const money = n => `$${(Number(n) || 0).toFixed(2)}`

export default function WorkLog() {
  const {
    user, staff, orders, config,
    getWorkday, upsertWorkLog, startBreak, endBreak, saveInquiry, addPost, deletePost, getPolicyText,
  } = useApp()
  const date = sydneyToday()
  const [day, setDay] = useState({ logs: [], breaks: [], inquiries: [], posts: [] })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [, setTick] = useState(0)
  const [policy, setPolicy] = useState({})

  const refresh = useCallback(async () => setDay(await getWorkday(date)), [getWorkday, date])
  useEffect(() => {
    let alive = true
    ;(async () => { const d = await getWorkday(date); if (alive) setDay(d) })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])
  useEffect(() => { getPolicyText().then(setPolicy) /* eslint-disable-next-line */ }, [])
  // 休息中每分钟刷新一次计时
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

  async function run(fn) {
    setBusy(true); setErr('')
    try { await fn(); await refresh() }
    catch (e) { setErr(e.message || '操作失败') }
    finally { setBusy(false) }
  }

  const mine = day.logs.find(l => l.staff_id === user?.id)
  const slots = useMemo(
    () => slotsForDay(config.breakWindows, config.staffSchedules, date),
    [config.breakWindows, config.staffSchedules, date])
  const prog = useMemo(
    () => inquiryProgress(config.channelAccounts, day.inquiries, date),
    [config.channelAccounts, day.inquiries, date])
  const perf = useMemo(() => myPerformance(orders, user?.id, date), [orders, user?.id, date])
  const wk = weekRange(date)
  const video = weeklyVideo(day.posts, wk.from, wk.to)
  const others = othersOnBreak(day.breaks, user?.id)
  const gap = tzGapHours()

  const [truth, setTruth] = useState(false)
  const canSubmit = !!mine?.clock_in && prog.ok && (!policy.truth_declaration || truth)
  const submitted = !!mine?.submitted_at

  return (
    <div className="p-5 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">我的日报</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {date} · 按{currentSeason() === 'summer' ? '夏令时' : '冬令时'}班次 · 悉尼比北京快 {gap} 小时
        </p>
      </div>
      {err && <p className="text-red-600 text-sm font-medium">{err}</p>}

      {/* ── 出勤 ─────────────────────────────── */}
      <Card title="出勤">
        <div className="flex items-center gap-3 flex-wrap">
          {!mine?.clock_in ? (
            <Btn icon={LogIn} disabled={busy} onClick={() => run(() => upsertWorkLog(date, { clock_in: new Date().toISOString() }))}>
              上班打卡
            </Btn>
          ) : (
            <span className="text-sm text-gray-600">
              上班 <b className="font-mono">{hhmm(mine.clock_in)}</b>
            </span>
          )}
          {mine?.clock_in && !mine?.clock_out && (
            <Btn icon={LogOut} ghost disabled={busy || !prog.ok}
              onClick={() => run(() => upsertWorkLog(date, { clock_out: new Date().toISOString() }))}>
              {prog.ok ? '下班打卡' : `还差 ${prog.missing.length} 个平台没登记`}
            </Btn>
          )}
          {mine?.clock_out && (
            <span className="text-sm text-gray-600">下班 <b className="font-mono">{hhmm(mine.clock_out)}</b></span>
          )}
        </div>

        {/* 三段休息 */}
        <div className="mt-4 space-y-2">
          {slots.map(w => {
            const rec = myBreak(day.breaks, user?.id, w.slot_index)
            const on = rec?.started_at && !rec?.ended_at
            const mins = breakMinutes(rec)
            const over = on && mins > (w.duration_min || 60)
            const taken = day.breaks.filter(b => b.slot_index === w.slot_index && b.staff_id !== user?.id)
            return (
              <div key={w.slot_index} className={`rounded-xl px-3 py-2.5 ${over ? 'bg-red-50' : on ? 'bg-amber-50' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-semibold text-sm w-16 shrink-0">{w.slot_name}</span>
                  <span className="text-xs text-gray-400 font-mono">
                    {w.window_start?.slice(0, 5)}–{w.window_end?.slice(0, 5)} 北京 · 任选 {w.duration_min} 分钟
                  </span>
                  <span className="flex-1" />
                  {rec?.ended_at ? (
                    <span className={`text-xs ${rec.overtime ? 'text-red-600 font-semibold' : 'text-green-600'}`}>
                      {hhmm(rec.started_at)}–{hhmm(rec.ended_at)} · {rec.minutes} 分钟
                      {rec.overtime && ' 超时'}
                    </span>
                  ) : on ? (
                    <>
                      <span className={`text-xs font-mono ${over ? 'text-red-600 font-bold' : 'text-amber-700'}`}>
                        休息中 {mins} 分钟{over && ' · 该回岗了'}
                      </span>
                      <Btn small disabled={busy} onClick={() => run(() => endBreak(date, w.slot_index, w.duration_min))}>
                        回来了
                      </Btn>
                    </>
                  ) : (
                    <Btn small ghost icon={Coffee} disabled={busy || !mine?.clock_in}
                      onClick={() => run(() => startBreak(date, w.slot_index))}>
                      去休息
                    </Btn>
                  )}
                </div>
                {/* 哪些时段还空着 —— 比固定排班表灵活 */}
                {!rec && (
                  <p className="text-xs text-gray-400 mt-1.5">
                    可选起点 {startOptions(w).join(' · ')}
                    {taken.length > 0 && (
                      <span className="text-amber-600 ml-2">
                        · {taken.map(b => staff.find(s => s.id === b.staff_id)?.name || b.staff_id).join('、')}
                        {taken.some(b => !b.ended_at) ? ' 正在休息' : ` 已休 ${hhmm(taken[0].started_at)}`}
                      </span>
                    )}
                  </p>
                )}
              </div>
            )
          })}
          {slots.length < 3 && (
            <p className="text-xs text-amber-600">
              今天只有你一个人在岗，不排下午休息（只有一个人看平台，休 3 小时没人接电话）
            </p>
          )}
          {others.length > 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              ⚠️ {others.map(b => staff.find(s => s.id === b.staff_id)?.name || b.staff_id).join('、')}
              正在休息。两人错开是为了始终有人看平台 —— 但特殊情况你还是可以去，只是要知道。
            </p>
          )}
        </div>
      </Card>

      {/* ── 平台咨询登记 ──────────────────────── */}
      <Card title="平台咨询登记" hint="7 个触点每天逐个检查。今天 0 个咨询也要登记 —— 填 0 就行，不填不算。左边贴当天发的内容标题作为凭证">
        <div className="space-y-1.5">
          {(config.channelAccounts || []).map(a => {
            const rec = day.inquiries.find(i => i.account_id === a.id)
            const planned = a.status !== 'active'
            const done = !!rec
            return (
              <div key={a.id} className="flex items-center gap-3 py-1">
                <span className="w-2 h-2 rounded-full shrink-0" style={{
                  background: planned ? '#d1d5db' : done ? '#22c55e' : '#f59e0b' }} />
                <span className="text-xs text-gray-400 w-12 shrink-0">{a.platform}</span>
                <span className={`text-sm w-20 shrink-0 ${planned ? 'text-gray-400' : 'font-semibold'}`}>{a.name}</span>
                <span className="text-xs text-gray-400 flex-1 truncate min-w-0">{a.positioning}</span>
                {planned ? (
                  <span className="text-xs text-gray-300 w-24 text-right shrink-0">未开通</span>
                ) : (
                  <>
                    {/* 老板 10-12：把当天发的内容标题贴进来，以证明。
                        数字无法验证，但「在这个号发了什么」Annie 能去平台核对。 */}
                    <input defaultValue={rec?.evidence ?? ''} placeholder="今天发的标题（可空）"
                      onBlur={e => run(() => saveInquiry(date, a.id, rec?.count ?? 0, e.target.value))}
                      className="w-44 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-red-400 shrink-0" />
                    <input type="number" min="0" step="1" placeholder="待填"
                      defaultValue={rec?.count ?? ''}
                      onBlur={e => { if (e.target.value !== '') run(() => saveInquiry(date, a.id, e.target.value, rec?.evidence)) }}
                      className={`w-20 border rounded-lg px-2 py-1 text-sm font-mono text-right outline-none focus:border-red-400 shrink-0 ${
                        done ? 'border-green-200 bg-green-50' : 'border-amber-300 bg-amber-50'}`} />
                  </>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100 text-sm">
          <span className="text-gray-500">今日咨询合计</span>
          <span className="font-mono font-bold text-lg">{prog.total} 人</span>
        </div>
        {!prog.ok && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-2">
            ⚠️ 还差 {prog.missing.map(a => a.name).join('、')} 没登记 —— 填完才能提交日报、才能下班
          </p>
        )}
      </Card>

      {/* ── 今日业绩（自动）────────────────────── */}
      <Card title="今日业绩" hint="系统自动算，不用填">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="我今天接的单" value={`${perf.booked} 单`} />
          <Stat label="接单金额" value={money(perf.bookedAmount)} />
          <Stat label="今天搬的（我接的）" value={`${perf.served} 单`} />
          <Stat label="完成金额" value={money(perf.servedAmount)} />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          「今天接的」按建单时刻算 —— 多数单是几天后才搬，两个数不一样是正常的
        </p>
      </Card>

      {/* ── 发布内容 ─────────────────────────── */}
      <Card title="今天发了什么"
        hint={video.ok ? `本周视频 ${video.video} 条 · 图文 ${video.image} 条` : '⚠️ 本周还没出视频 —— 每周至少 1 条'}>
        <PostAdder accounts={requiredAccounts(config.channelAccounts)} disabled={busy}
          onAdd={v => run(() => addPost(date, v))} />
        <div className="mt-2 space-y-1">
          {day.posts.map(p => {
            const a = (config.channelAccounts || []).find(x => x.id === p.account_id)
            return (
              <div key={p.id} className="flex items-center gap-2 text-sm py-1">
                <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                  p.kind === 'video' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                  {p.kind === 'video' ? '视频' : '图文'}
                </span>
                <span className="font-semibold text-xs w-16 shrink-0">{a?.name || p.account_id}</span>
                <span className="text-gray-600 flex-1 truncate">{p.title || '（没写标题）'}</span>
                <button onClick={() => run(() => deletePost(p.id))} disabled={busy}
                  className="text-gray-300 hover:text-red-500 shrink-0"><Trash2 size={13} /></button>
              </div>
            )
          })}
          {day.posts.length === 0 && <p className="text-sm text-gray-400 py-1">今天还没登记发布内容</p>}
        </div>
      </Card>

      {/* ── 手填三项 ─────────────────────────── */}
      <Card title="主动开发 / 其他工作">
        <textarea rows={2} defaultValue={mine?.outreach || ''}
          placeholder="例如：在 3 个租房群发名片，加到 2 个意向客户"
          onBlur={e => run(() => upsertWorkLog(date, { outreach: e.target.value }))}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400 resize-none" />
      </Card>

      <Card title="问题 / 明天注意" hint="交给明天的人">
        <textarea rows={2} defaultValue={mine?.issues || ''}
          placeholder="例如：盼达号有个客人问长途报价，我不确定，明天问一下老板"
          onBlur={e => run(() => upsertWorkLog(date, { issues: e.target.value }))}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400 resize-none" />
      </Card>

      {/* ── 提交 ─────────────────────────────── */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        {submitted ? (
          <p className="text-center text-green-700 font-semibold text-sm flex items-center justify-center gap-1.5">
            <Check size={16} /> 今日日报已提交 {hhmm(mine.submitted_at)}
          </p>
        ) : (
          <>
            {policy.truth_declaration && (
              <label className="flex items-start gap-2 mb-3 cursor-pointer">
                <input type="checkbox" checked={truth} onChange={e => setTruth(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-red-700 shrink-0" />
                <span className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">
                  {policy.truth_declaration}
                </span>
              </label>
            )}
            <button disabled={busy || !canSubmit}
              onClick={() => run(() => upsertWorkLog(date, {
                submitted_at: new Date().toISOString(), truth_confirmed: true }))}
              className="w-full text-white font-bold py-3 rounded-xl disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#6b1414,#c0392b)' }}>
              {!mine?.clock_in ? '先打上班卡'
                : !prog.ok ? `提交今日记录 · 还差 ${prog.missing.length} 项`
                : !truth && policy.truth_declaration ? '请先勾选上面的确认'
                : '提交今日记录'}
            </button>
            {!prog.ok && (
              <p className="text-xs text-gray-400 text-center mt-2">
                7 个触点逐个登记完才能提交 —— 0 个咨询也要填 0
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function PostAdder({ accounts, onAdd, disabled }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || '')
  const [kind, setKind] = useState('image')
  const [title, setTitle] = useState('')
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select value={accountId} onChange={e => setAccountId(e.target.value)}
        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-red-400">
        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <div className="flex gap-1">
        {[['image', '图文'], ['video', '视频']].map(([v, l]) => (
          <button key={v} onClick={() => setKind(v)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
              kind === v ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'}`}>{l}</button>
        ))}
      </div>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="标题"
        className="flex-1 min-w-32 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-red-400" />
      <button disabled={disabled || !accountId}
        onClick={() => { onAdd({ accountId, kind, title }); setTitle('') }}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-white text-xs font-semibold disabled:opacity-40"
        style={{ background: 'linear-gradient(135deg,#6b1414,#c0392b)' }}>
        <Plus size={13} /> 添加
      </button>
    </div>
  )
}

function Card({ title, hint, children }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <h2 className="font-bold text-gray-900 text-sm">{title}</h2>
      {hint && <p className="text-xs text-gray-400 mt-0.5 mb-2.5">{hint}</p>}
      {!hint && <div className="mb-2.5" />}
      {children}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-mono font-bold text-base mt-0.5 text-gray-800">{value}</p>
    </div>
  )
}

function Btn({ children, icon: Icon, onClick, disabled, ghost, small }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex items-center gap-1.5 rounded-lg font-semibold disabled:opacity-40 ${
        small ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm'} ${
        ghost ? 'border border-gray-200 text-gray-600 hover:bg-gray-50' : 'text-white'}`}
      style={ghost ? {} : { background: 'linear-gradient(135deg,#6b1414,#c0392b)' }}>
      {Icon && <Icon size={small ? 12 : 14} />}{children}
    </button>
  )
}
