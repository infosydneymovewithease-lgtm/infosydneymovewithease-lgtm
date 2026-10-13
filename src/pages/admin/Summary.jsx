// 周月汇总复盘 —— 2026-10-12 第 6 步（最后一步）
//
// 核心原则：全自动，不让员工重抄。
// 六块里只有「下阶段调整」是人工写的，其余全从已有数据算。
//
// 权限（老板 10-11 定）：
//   周汇总  客服也能看（自己的那行）
//   月汇总  只有老板和 Annie —— 「周可以看，月以上就不能查看」

import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { sydneyToday } from '../../utils/date'
import {
  overview, staffStats, insights, gaps, recentMonths, periodRange,
} from '../../utils/summary'
import { Lock, Save, Check } from 'lucide-react'

const money = n => `$${(Number(n) || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = n => n == null ? '—' : `${(n * 100).toFixed(0)}%`

export default function Summary() {
  const { user, staff, orders, staffRates, config, getPeriodData, getSummaryNote, saveSummaryNote } = useApp()
  const today = sydneyToday()
  const [kind, setKind] = useState('month')
  const [anchor, setAnchor] = useState(() => today.slice(0, 7))
  const [data, setData] = useState({ logs: [], breaks: [], inquiries: [], posts: [], closes: [] })
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const isBoss = user?.role === 'admin' || user?.role === 'manager'
  // 客服看不到月汇总 —— 老板 10-11：「周可以看，月以上就不能查看」
  const effKind = isBoss ? kind : 'week'
  const range = useMemo(
    () => periodRange(effKind, effKind === 'month' ? anchor : today),
    [effKind, anchor, today])
  const period = effKind === 'month' ? anchor : `${range.from}~${range.to}`

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [d, n] = await Promise.all([getPeriodData(range.from, range.to), getSummaryNote(period)])
      if (alive) { setData(d); setNote(n?.content || ''); setSaved(false) }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, period])

  const staffIds = useMemo(
    () => [...new Set((config.staffSchedules || []).map(s => s.staff_id))], [config.staffSchedules])
  const ov = useMemo(() => overview(orders, range.from, range.to, staffRates), [orders, range, staffRates])
  const months = useMemo(() => recentMonths(today, 6), [today])
  const ins = useMemo(() => insights(orders, months), [orders, months])
  const rows = useMemo(() => staffStats({ ...data, orders, from: range.from, to: range.to, staffIds }),
    [data, orders, range, staffIds])
  const problems = useMemo(() => gaps({ ...data, orders, accounts: config.channelAccounts,
    staffIds, from: range.from, to: range.to, staffRates }),
    [data, orders, config.channelAccounts, staffIds, range, staffRates])

  const visibleRows = isBoss ? rows : rows.filter(r => r.id === user?.id)
  // 客服提的问题 —— 只有 admin 能看，经理也不行
  const issueList = useMemo(() => (data.logs || [])
    .filter(l => l.issues && l.issues.trim())
    .sort((a, b) => String(b.work_date).localeCompare(String(a.work_date))), [data.logs])
  const maxRev = Math.max(...ins.trend.map(t => t.revenue), 1)

  async function save() {
    setBusy(true); setErr('')
    try { await saveSummaryNote(period, note); setSaved(true) }
    catch (e) { setErr(e.message || '保存失败') }
    finally { setBusy(false) }
  }

  return (
    <div className="p-5 max-w-4xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {effKind === 'month' ? '月度' : '周'}汇总与复盘
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {range.from} ~ {range.to} · 全部自动聚合，只有「下阶段调整」要人工写
          </p>
        </div>
        {isBoss ? (
          <div className="flex items-center gap-1 bg-white rounded-xl shadow-sm p-1">
            {[['week', '本周'], ['month', '本月']].map(([k, l]) => (
              <button key={k} onClick={() => setKind(k)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  kind === k ? 'text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                style={kind === k ? { background: 'linear-gradient(135deg,#6b1414,#c0392b)' } : {}}>{l}</button>
            ))}
            {kind === 'month' && (
              <input type="month" value={anchor} onChange={e => setAnchor(e.target.value)}
                className="px-2 py-1 text-sm font-semibold outline-none" />
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Lock size={11} /> 月汇总只有老板和客服经理能看
          </p>
        )}
      </div>
      {err && <p className="text-red-600 text-sm font-medium">{err}</p>}

      {/* ① 经营概况 */}
      {isBoss && (
        <Card title="经营概况" lock>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="订单" value={`${ov.orders} 单`} sub={`完成 ${ov.completed} · 取消 ${ov.cancelled}`} />
            <Stat label="营收" value={money(ov.revenue)} />
            <Stat label="客单价" value={money(ov.avgOrder)} sub="只算已完成的单" />
            <Stat label="工资支出" value={money(ov.wages)} sub={`占营收 ${pct(ov.wageRatio)}`} />
          </div>
          {/* 近 6 个月趋势 */}
          <div className="flex items-end gap-2 h-24 mt-5 px-1">
            {ins.trend.map(t => (
              <div key={t.month} className="flex-1 flex flex-col items-center justify-end h-full">
                <span className="text-xs text-gray-400 mb-1">{t.count}</span>
                <div className="w-full rounded-t"
                  style={{ height: `${Math.max(t.revenue / maxRev * 100, 2)}%`,
                           background: t.month === today.slice(0, 7)
                             ? 'linear-gradient(180deg,#f0a500,#d97706)'
                             : 'linear-gradient(180deg,#c0392b,#6b1414)' }} />
                <span className="text-xs text-gray-400 mt-1">{t.month.slice(5)}月</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            柱高＝营收，上方数字＝完成单数。当月（橙色）还没过完，不要直接和整月比
          </p>
        </Card>
      )}

      {/* ② 客服工作情况 */}
      <Card title="客服工作情况" lock={isBoss}
        hint={isBoss ? '全部自动。接单按建单时刻归属，咨询按登记人归属 —— 两个人在岗时各自的数是分开的' : '只显示你自己的'}>
        {visibleRows.map(r => {
          const who = staff.find(s => s.id === r.id)
          const mgr = r.dayConfirms + r.ordersChecked + r.fixesMade > 0
          return (
            <div key={r.id} className="py-3 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-bold">{who?.name || r.id}</span>
                <span className="text-xs text-gray-400">
                  {r.days} 天 · {r.hours} 小时 · 日报 {r.submitted}/{r.days}
                </span>
                {r.overtimeBreaks > 0 && (
                  <span className="text-xs text-red-600">餐休超时 {r.overtimeBreaks} 次</span>
                )}
              </div>

              <p className="text-xs text-gray-400 mb-1">
                接待与接单 <span className="text-gray-300">平台咨询 → 加微信 → 下单</span>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-2">
                <Mini label="平台咨询" value={`${r.inquiries} 人`} sub="应接待" />
                <Mini label="加微信" value={`${r.wechatAdds} 人`}
                  sub={r.outreachAdds ? `其中主动开发 ${r.outreachAdds}` 
                    : r.inquiries ? `留下 ${Math.round(r.wechatAdds / r.inquiries * 100)}%` : '实际接待'} />
                <Mini label="接单" value={`${r.created} 单`}
                  sub={r.wechatAdds ? `成交 ${Math.round(r.created / r.wechatAdds * 100)}%` : null} />
                <Mini label="接单金额" value={money(r.amount)} />
                <Mini label="总转化" value={pct(r.rate)} sub="下单÷平台咨询" />
              </div>

              <p className="text-xs text-gray-400 mb-1">运营与管理</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <Mini label="发布" value={`${r.posts} 条`} sub={r.videos ? `含视频 ${r.videos}` : null} />
                <Mini label="主动开发" value={`${r.outreachDays}/${r.days} 天`}
                  sub={r.outreachAdds ? `带来 ${r.outreachAdds} 人` : null} />
                <Mini label="日结确认" value={`${r.dayConfirms} 天`} dim={!mgr} />
                <Mini label="核对订单" value={`${r.ordersChecked} 单`} dim={!mgr} />
                <Mini label="补录" value={`${r.fixesMade} 笔`} dim={!mgr} />
              </div>
            </div>
          )
        })}
        {visibleRows.length === 0 && <p className="text-sm text-gray-400">这期间还没有打卡记录</p>}
        <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-dashed border-gray-200 leading-relaxed">
          ⚠️ <b>接单少不等于产出低。</b> 经理把时间花在核对和运营上，接单自然少；
          顶班那天接待量也会和平时不一样。两组数要一起看，<b>不要只盯接单数</b>。
        </p>
      </Card>

      {/* ③ 大形势判断 */}
      {isBoss && (
        <Card title="大形势判断" lock hint="全部从数据算出来的，不是写死的结论">
          <div className="space-y-2">
            {ins.insights.map((x, i) => (
              <div key={i} className="flex gap-2.5 text-sm">
                <span className="shrink-0">{x.icon}</span>
                <span>
                  <b className={x.sev === 'warn' ? 'text-amber-700' : x.sev === 'good' ? 'text-green-700' : ''}>
                    {x.title}
                  </b>
                  <span className="text-gray-500 ml-2">{x.text}</span>
                </span>
              </div>
            ))}
            {ins.insights.length === 0 && <p className="text-sm text-gray-400">数据还不够，看不出趋势</p>}
          </div>
        </Card>
      )}

      {/* ④ 结构分布 */}
      {isBoss && (
        <Card title="结构分布">
          {ins.byVehicle.map(([v, n]) => {
            const total = ins.byVehicle.reduce((s, [, x]) => s + x, 0)
            return (
              <div key={v} className="flex items-center gap-3 py-1 text-sm">
                <span className="w-16 shrink-0">{v}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded">
                  <div className="h-full rounded" style={{ width: `${n / total * 100}%`,
                    background: 'linear-gradient(90deg,#6b1414,#c0392b)' }} />
                </div>
                <span className="font-mono text-xs text-gray-500 w-16 text-right">{n} 单</span>
              </div>
            )
          })}
          <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-dashed border-gray-200">
            渠道结构（哪个号带来多少单）需要「获客来源」字段 —— 老板暂缓，做了就能显示
          </p>
        </Card>
      )}

      {/* ⑤ 遗漏与问题 */}
      <Card title="本期遗漏与问题" hint="自动抓，不用人找">
        <div className="space-y-1.5">
          {problems.map((p, i) => (
            <p key={i} className={`text-sm ${p.sev === 'high' ? 'text-red-600' : 'text-amber-600'}`}>
              {p.sev === 'high' ? '🔴' : '🟠'} {p.text}
            </p>
          ))}
          {problems.length === 0 && (
            <p className="text-sm text-green-700 flex items-center gap-1.5"><Check size={14} /> 这期间没抓到问题</p>
          )}
        </div>
      </Card>

      {/* ⑥ 大家提的问题 —— 只有老板能看 */}
      {user?.role === 'admin' && (
        <Card title="大家提的问题 · 想改进的地方"
          hint="客服在日报里写的，只有你能看到（客服经理也看不到）。每周例会上提出讨论">
          {issueList.length === 0 ? (
            <p className="text-sm text-gray-400">这期间没人提问题</p>
          ) : (
            <div className="space-y-2.5">
              {issueList.map((x, i) => (
                <div key={i} className="border-l-2 border-blue-200 pl-3">
                  <p className="text-xs text-gray-400">
                    {staff.find(s => s.id === x.staff_id)?.name || x.staff_id} · {x.work_date}
                  </p>
                  <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed mt-0.5">{x.issues}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ⑦ 下阶段调整 */}
      <Card title="下阶段调整" hint="整份报告唯一需要人工写的地方">
        <textarea rows={4} value={note} onChange={e => { setNote(e.target.value); setSaved(false) }}
          placeholder={'例如：\n1. 复购率 13% → 年底目标 20%，开始做老客回访\n2. 视频号产出不达标，Annie 专项负责'}
          disabled={!isBoss}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400 resize-none disabled:bg-gray-50" />
        {isBoss && (
          <div className="flex items-center gap-3 mt-2">
            <button onClick={save} disabled={busy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#6b1414,#c0392b)' }}>
              <Save size={14} /> 保存
            </button>
            {saved && <span className="text-xs text-green-600 flex items-center gap-1"><Check size={12} /> 已保存</span>}
          </div>
        )}
      </Card>
    </div>
  )
}

function Card({ title, hint, lock, children }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <h2 className="font-bold text-gray-900 text-sm">{title}</h2>
        {lock && (
          <span className="text-xs bg-red-50 text-red-700 px-1.5 py-0.5 rounded flex items-center gap-1">
            <Lock size={9} /> 老板 + Annie
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      <div className="mt-3">{children}</div>
    </div>
  )
}

function Mini({ label, value, sub, dim }) {
  return (
    <div className={`rounded-lg px-2.5 py-1.5 ${dim ? 'bg-gray-50/60' : 'bg-gray-50'}`}>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`font-mono font-semibold text-sm mt-0.5 ${dim ? 'text-gray-400' : 'text-gray-800'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

function Stat({ label, value, sub }) {
  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-mono font-bold text-base mt-0.5 text-gray-800">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
