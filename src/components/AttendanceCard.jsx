// 出勤打卡 —— 2026-10-13
//
// 老板 10-13：「这一部分可以加在首页工作台的上方…方便工人打卡，
//              我的日报只要自动同步数据就好了」
//
// 所以抽成共用组件：工作台顶部放完整版（一进来就能打卡），
// 我的日报放紧凑版（只显示，不重复操作）。
// 两边读写的是同一份 daily_work_log + break_record，天然同步。

import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { sydneyToday } from '../utils/date'
import { currentSeason, tzGapHours } from '../utils/shifts'
import { slotsForDay, startOptions, othersOnBreak, myBreak, breakMinutes } from '../utils/worklog'
import { LogIn, LogOut, Coffee } from 'lucide-react'

const hhmm = iso => iso
  ? new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  : '—'

export default function AttendanceCard({ compact = false }) {
  const { user, staff, config, getWorkday, upsertWorkLog, startBreak, endBreak } = useApp()
  const date = sydneyToday()
  const [day, setDay] = useState({ logs: [], breaks: [] })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [confirmOut, setConfirmOut] = useState(false)
  const [, setTick] = useState(0)

  const refresh = useCallback(async () => setDay(await getWorkday(date)), [getWorkday, date])
  useEffect(() => {
    let alive = true
    ;(async () => { const d = await getWorkday(date); if (alive) setDay(d) })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])
  // 休息中每半分钟刷新计时
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
  const slots = slotsForDay(config.breakWindows, config.staffSchedules, date)
  const others = othersOnBreak(day.breaks, user?.id)
  const onBreakNow = slots.find(w => {
    const r = myBreak(day.breaks, user?.id, w.slot_index)
    return r?.started_at && !r?.ended_at
  })

  // ── 紧凑版：只显示，不操作（我的日报用）──────────────────
  if (compact) {
    return (
      <div className="flex items-center gap-3 text-sm flex-wrap">
        <span className="text-gray-500">
          上班 <b className="font-mono text-gray-800">{hhmm(mine?.clock_in)}</b>
          {mine?.clock_out && <> · 下班 <b className="font-mono text-gray-800">{hhmm(mine.clock_out)}</b></>}
        </span>
        {slots.map(w => {
          const r = myBreak(day.breaks, user?.id, w.slot_index)
          const on = r?.started_at && !r?.ended_at
          return (
            <span key={w.slot_index} className={`text-xs px-2 py-0.5 rounded ${
              r?.overtime ? 'bg-red-100 text-red-700'
              : on ? 'bg-amber-100 text-amber-700'
              : r ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
              {w.slot_name}{r ? (r.ended_at ? ` ${r.minutes}分` : ' 休息中') : ' 未休'}
            </span>
          )
        })}
        <span className="text-xs text-gray-400">在工作台打卡</span>
      </div>
    )
  }

  // ── 完整版：工作台顶部 ──────────────────────────────
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      {err && <p className="text-red-600 text-sm mb-2">{err}</p>}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-bold text-gray-900 text-sm shrink-0">出勤</h2>
        <span className="text-xs text-gray-400 shrink-0">
          {currentSeason() === 'summer' ? '夏令时' : '冬令时'}班次 · 悉尼比北京快 {tzGapHours()} 小时
        </span>
        <span className="flex-1" />

        {!mine?.clock_in ? (
          <button disabled={busy}
            onClick={() => run(() => upsertWorkLog(date, { clock_in: new Date().toISOString() }))}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#6b1414,#c0392b)' }}>
            <LogIn size={15} /> 上班打卡
          </button>
        ) : (
          <>
            <span className="text-sm text-gray-600">
              上班 <b className="font-mono">{hhmm(mine.clock_in)}</b>
              {mine.clock_out && <> · 下班 <b className="font-mono">{hhmm(mine.clock_out)}</b></>}
            </span>
            {/* 老板 10-15 测试时上班下班点在了同一分钟，露出两个问题：
                ① 下班之后休息那排就不显示了（行为是对的，但他以为没做）
                ② 下班打卡【点错了没法撤销】—— 早上手滑点一下，
                   这一天的出勤就毁了，界面上没有任何办法改回来，
                   只能来找老板跑 SQL。两个都补上。 */}
            {!mine.clock_out ? (
              confirmOut ? (
                <span className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">现在下班？下班后不能再登记休息</span>
                  <button disabled={busy}
                    onClick={() => { setConfirmOut(false); run(() => upsertWorkLog(date, { clock_out: new Date().toISOString() })) }}
                    className="px-3 py-1.5 rounded-xl text-white text-sm font-bold disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg,#6b1414,#c0392b)' }}>确认下班</button>
                  <button onClick={() => setConfirmOut(false)}
                    className="text-sm text-gray-400 px-1">取消</button>
                </span>
              ) : (
                <button disabled={busy} onClick={() => setConfirmOut(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 disabled:opacity-40">
                  <LogOut size={14} /> 下班打卡
                </button>
              )
            ) : (
              <button disabled={busy}
                onClick={() => run(() => upsertWorkLog(date, { clock_out: null }))}
                className="text-xs text-gray-400 hover:text-red-600 underline px-1">
                点错了？撤销下班
              </button>
            )}
          </>
        )}
      </div>

      {/* 三段休息 */}
      {mine?.clock_in && !mine?.clock_out && (
        <div className="grid sm:grid-cols-3 gap-2 mt-3">
          {slots.map(w => {
            const r = myBreak(day.breaks, user?.id, w.slot_index)
            const on = r?.started_at && !r?.ended_at
            const mins = breakMinutes(r)
            const over = on && mins > (w.duration_min || 60)
            return (
              <div key={w.slot_index}
                className={`rounded-xl px-3 py-2 ${over ? 'bg-red-50' : on ? 'bg-amber-50' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm">{w.slot_name}</span>
                  {r?.ended_at ? (
                    <span className={`text-xs ${r.overtime ? 'text-red-600 font-semibold' : 'text-green-600'}`}>
                      {r.minutes} 分钟{r.overtime && ' 超时'}
                    </span>
                  ) : on ? (
                    <button disabled={busy} onClick={() => run(() => endBreak(date, w.slot_index, w.duration_min))}
                      className="px-2.5 py-1 rounded-lg text-white text-xs font-semibold disabled:opacity-40"
                      style={{ background: 'linear-gradient(135deg,#6b1414,#c0392b)' }}>回来了</button>
                  ) : (
                    <button disabled={busy} onClick={() => run(() => startBreak(date, w.slot_index))}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 text-xs hover:bg-white disabled:opacity-40">
                      <Coffee size={11} /> 去休息
                    </button>
                  )}
                </div>
                <p className={`text-xs mt-0.5 ${over ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                  {on ? `休息中 ${mins} 分钟${over ? ' · 该回岗了' : ''}`
                    : r?.ended_at ? `${hhmm(r.started_at)}–${hhmm(r.ended_at)}`
                    : `${w.window_start?.slice(0, 5)}–${w.window_end?.slice(0, 5)} 北京 · 可选 ${startOptions(w).join('/')}`}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {slots.length < 3 && mine?.clock_in && (
        <p className="text-xs text-amber-600 mt-2">
          今天只有你一个人在岗，不排下午休息（只有一个人看平台，休 3 小时没人接电话）
        </p>
      )}
      {others.length > 0 && !onBreakNow && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-2">
          ⚠️ {others.map(b => staff.find(s => s.id === b.staff_id)?.name || b.staff_id).join('、')}
          正在休息。两人错开是为了始终有人看平台 —— 特殊情况你还是可以去，只是要知道
        </p>
      )}
    </div>
  )
}
