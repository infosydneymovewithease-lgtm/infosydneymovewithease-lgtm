// 排班表 —— 2026-10-16
//
// 老板 10-16：「这个表格还需要一个重要的功能，我和经理可以对这个表格
//              休息人员进行调整」
//
// 两条贯穿整页的设计：
//  ① 自动生成打底，改哪格改哪格 —— 手工排 11 周 × 2 人 = 154 格没人排得动，
//    但全自动又改不了现实（临时有事、她们自己换班）
//  ② 【改之前先告诉她后果】—— 排班直接影响两个人的生活，也直接影响
//    客人能不能找到人。不能改完才发现那天没人了。

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { sydneyToday } from '../../utils/date'
import {
  SHIFT, SHIFT_KEYS, byDate, onDutyCount, previewChange, rosterStats, monthCells,
  demandWindows, daySignals, monthAlert,
} from '../../utils/roster'
import { ChevronLeft, ChevronRight, Check, AlertTriangle } from 'lucide-react'

const WEEK = ['一', '二', '三', '四', '五', '六', '日']
const CELL_BG = { 0: 'bg-red-50 border-red-200', 1: 'bg-amber-50 border-amber-200', 2: 'bg-green-50 border-green-200' }

export default function Roster() {
  const { user, staff, getRoster, generateRoster, setRoster } = useApp()
  const today = sydneyToday()
  const [ym, setYm] = useState(() => today.slice(0, 7))
  const [data, setData] = useState({ roster: [], holidays: [] })
  const [open, setOpen] = useState(null)   // 正在编辑的日期
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const canEdit = user?.role === 'admin' || user?.role === 'manager'
  const [y, m] = ym.split('-').map(Number)
  const from = `${ym}-01`
  const to = `${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`

  const refresh = useCallback(async () => setData(await getRoster(from, to)), [getRoster, from, to])
  useEffect(() => { refresh() /* eslint-disable-next-line */ }, [ym])

  const days = useMemo(() => byDate(data.roster), [data.roster])
  const ids = useMemo(() => [...new Set(data.roster.map(r => r.staff_id))], [data.roster])
  const stats = useMemo(() => rosterStats(data.roster, ids), [data.roster, ids])
  const nameOf = id => staff?.find(s => s.id === id)?.name || id
  // 老板 10-16：把节日学期日历融进排班表 —— 排班表原来只显示供给，不显示需求
  const windows = useMemo(() => demandWindows(data.holidays), [data.holidays])
  const alert   = useMemo(() => monthAlert(data.holidays, ym), [data.holidays, ym])
  const sigOf   = d => daySignals(data.holidays, windows, d)

  async function run(fn, ok) {
    setBusy(true); setErr(''); setMsg('')
    try { const r = await fn(); await refresh(); if (ok) setMsg(ok(r)) }
    catch (e) { setErr(e.message || '操作失败') } finally { setBusy(false) }
  }

  const cells = monthCells(y, m)

  return (
    <div className="p-5 max-w-5xl mx-auto space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">排班表</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            A 班 北京 06:00–17:00（悉尼 09–20）· B 班 北京 08:00–19:00（悉尼 11–22）
            {!canEdit && ' · 你只能查看'}
          </p>
        </div>
        <div className="flex items-center bg-white rounded-xl shadow-sm">
          <button onClick={() => setYm(shiftMonth(ym, -1))} className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg"><ChevronLeft size={18} /></button>
          <span className="px-2 text-sm font-semibold">{y} 年 {m} 月</span>
          <button onClick={() => setYm(shiftMonth(ym, 1))} className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg"><ChevronRight size={18} /></button>
        </div>
      </div>

      {(err || msg) && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[90%] rounded-xl px-4 py-3 shadow-lg flex items-start gap-2 ${
          err ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'}`}>
          <span className="text-sm flex-1 leading-relaxed">{err || msg}</span>
          <button onClick={() => { setErr(''); setMsg('') }} className="opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Kpi label="双人在岗" value={`${stats.double} 天`} />
        <Kpi label="单人在岗" value={`${stats.single} 天`} />
        <Kpi label="无人" value={`${stats.zero} 天`} warn={stats.zero > 0} />
        <Kpi label="人工调整过" value={`${stats.edited} 格`} />
      </div>

      {/* ① 需求提示条 —— 放在月历【上面】。
             放下面就晚了，排班的人已经排完了。淡季月份不出现。 */}
      {alert && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-2.5">
          <span className="shrink-0 text-base leading-none mt-0.5">🎓</span>
          <p className="text-sm text-amber-900 leading-relaxed flex-1">{alert}</p>
        </div>
      )}

      {data.roster.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
          <p className="text-sm text-gray-600 mb-3">这个月还没有排班</p>
          {canEdit && (
            <button disabled={busy} onClick={() => run(() => generateRoster(from, to), r => `生成了 ${r.created} 格`)}
              className="text-white font-bold px-5 py-2.5 rounded-xl text-sm disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#6b1414,#c0392b)' }}>
              按规则生成本月排班
            </button>
          )}
          <p className="text-xs text-gray-400 mt-2.5">
            小洁 A=日一二三 B=四五 休=六 · Annie A=四五六 B=二三 休=日一<br />
            中国法定假期自动标「假」，谁顶由你们手动改
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-4 shadow-sm overflow-x-auto">
          <div className="min-w-[680px]">
            <div className="grid grid-cols-7 gap-1.5 mb-1.5">
              {WEEK.map(w => <div key={w} className="text-xs text-gray-400 text-center font-semibold">{w}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((d, i) => {
                if (!d) return <div key={`e${i}`} />
                const dm = days.get(d) || {}
                const n = onDutyCount(dm)
                const sig = sigOf(d)
                return (
                  <button key={d} onClick={() => canEdit && setOpen(d)} disabled={!canEdit}
                    className={`min-h-[72px] rounded-xl border p-1.5 text-left ${CELL_BG[n] || 'bg-gray-50 border-gray-200'} ${
                      canEdit ? 'hover:ring-2 hover:ring-red-300' : ''} ${d === today ? 'ring-2 ring-gray-900' : ''}`}>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs font-bold text-gray-700">{Number(d.slice(8))}</span>
                      {data.roster.some(r => r.work_date === d && r.auto === false) && (
                        <span className="text-[9px] text-gray-400">改过</span>
                      )}
                      <span className="flex-1" />
                      {/* 图标不用文字 —— 格子只有 72px 高，假期全名会挤爆。
                          鼠标移上去看全名。 */}
                      <span className="text-[10px] leading-none" title={sig.map(x => x.text).join(' · ')}>
                        {sig.map(x => x.icon).join('')}
                      </span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {ids.map(id => {
                        const sh = dm[id]?.shift
                        return (
                          <div key={id} className="flex items-center gap-1 text-[10px] leading-tight">
                            <span className="text-gray-300 w-3 shrink-0">{nameOf(id).slice(-1)}</span>
                            <span className={`font-bold ${SHIFT[sh]?.cls || 'text-gray-300'}`}>
                              {SHIFT[sh]?.short || '—'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    {sig.length > 0 && (
                      <span className="block text-[9px] text-amber-700 truncate mt-0.5">{sig[0].text}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex gap-3 text-xs text-gray-400 mt-3 flex-wrap">
            <Lg cls="bg-green-50 border-green-200">双人（悉尼 09–22）</Lg>
            <Lg cls="bg-amber-50 border-amber-200">单人（只到 20:00）</Lg>
            <Lg cls="bg-red-50 border-red-200">无人</Lg>
            <span><b className="text-red-700">A</b> 早班 · <b className="text-purple-700">B</b> 晚班 · <b className="text-green-600">补休</b></span>
            <span>🎓 搬家高峰 · 🇨🇳 中国假期 · 🎄 澳洲假期</span>
          </div>

          {canEdit && (
            <button disabled={busy} onClick={() => run(() => generateRoster(from, to), r => r.created ? `补了 ${r.created} 格` : '这个月已经排满了')}
              className="text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 mt-3 hover:bg-gray-50 disabled:opacity-40">
              补生成空格子（不覆盖改过的）
            </button>
          )}
        </div>
      )}

      {/* 每人本月汇总 */}
      {data.roster.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold text-sm mb-2">本月各自的班</h2>
          <div className="space-y-1.5">
            {ids.map(id => {
              const p = stats.per[id] || {}
              return (
                <div key={id} className="flex items-center gap-3 text-sm flex-wrap py-1">
                  <span className="font-semibold w-16 shrink-0">{nameOf(id)}</span>
                  <span className="text-red-700">A {p.A || 0} 天</span>
                  <span className="text-purple-700">B {p.B || 0} 天</span>
                  <span className="text-gray-400">例休 {p.off || 0}</span>
                  <span className="text-green-600">补休 {p.leave || 0}</span>
                  {p.holiday > 0 && <span className="text-amber-600">假期 {p.holiday}</span>}
                  <span className="flex-1" />
                  <span className="text-xs text-gray-400">上班 {(p.A || 0) + (p.B || 0)} 天</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {open && (
        <DayEditor date={open} dayMap={days.get(open) || {}} ids={ids} nameOf={nameOf}
          sig={sigOf(open)} busy={busy}
          onClose={() => setOpen(null)}
          onSet={async (sid, sh) => { await run(() => setRoster(open, sid, sh)) }} />
      )}
    </div>
  )
}

function DayEditor({ date, dayMap, ids, nameOf, sig, busy, onClose, onSet }) {
  const n = onDutyCount(dayMap)
  const peak = (sig || []).find(x => x.kind === 'out' || x.kind === 'in')
  const [y, m, d] = date.split('-').map(Number)
  const wd = WEEK[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7]

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm">{date} 周{wd}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
            n === 0 ? 'bg-red-100 text-red-700' : n === 1 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
            在岗 {n} 人
          </span>
          {sig.map((x, i) => (
            <span key={i} className="text-xs text-amber-700">{x.icon} {x.text}</span>
          ))}
          <span className="flex-1" />
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg leading-none">✕</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {ids.map(id => {
            const cur = dayMap[id]?.shift
            return (
              <div key={id}>
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className="font-semibold text-sm">{nameOf(id)}</span>
                  {dayMap[id]?.auto === false && (
                    <span className="text-xs text-gray-400">
                      人工改过{dayMap[id].updated_by ? ` · ${dayMap[id].updated_by}` : ''}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {SHIFT_KEYS.map(k => {
                    const pv = previewChange(dayMap, id, k)
                    const active = cur === k
                    return (
                      <button key={k} disabled={busy || active} onClick={() => onSet(id, k)}
                        title={pv.warn || ''}
                        className={`py-2 rounded-lg text-xs font-bold border transition-colors ${
                          active ? 'text-white border-transparent'
                          : pv.warn ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        style={active ? { background: 'linear-gradient(135deg,#6b1414,#c0392b)' } : undefined}>
                        {SHIFT[k].short}
                        {active && <Check size={10} className="inline ml-0.5" />}
                      </button>
                    )
                  })}
                </div>
                {/* 改之前就告诉她后果 —— 这是整页最该有的东西 */}
                {SHIFT_KEYS.map(k => {
                  if (cur === k) return null
                  const pv = previewChange(dayMap, id, k)
                  if (!pv.warn) return null
                  return (
                    <p key={k} className="text-xs text-amber-700 mt-1 flex items-start gap-1">
                      <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                      <span>改成「{SHIFT[k].label}」：{pv.warn}</span>
                    </p>
                  )
                })}
                {/* ③ 已经点下去那一刻的最后一道提醒 */}
                {peak && (
                  <p className="text-xs text-red-700 mt-1 flex items-start gap-1 font-semibold">
                    <span className="shrink-0">🎓</span>
                    <span>这天在{peak.text}期内 —— 减人要想清楚</span>
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-400 leading-relaxed">
            改完立刻生效，谁改的会记进操作日志。
            重新「补生成」不会覆盖人工改过的格子。
          </p>
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value, warn }) {
  return (
    <div className={`rounded-xl px-3 py-2.5 shadow-sm ${warn ? 'bg-amber-50 border border-amber-200' : 'bg-white'}`}>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${warn ? 'text-amber-700' : 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

function Lg({ cls, children }) {
  return <span className="flex items-center gap-1"><i className={`w-2.5 h-2.5 rounded-sm border ${cls}`} />{children}</span>
}

function shiftMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
