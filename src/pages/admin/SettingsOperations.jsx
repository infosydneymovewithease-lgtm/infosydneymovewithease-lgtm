// 系统设置 · 运营配置 —— 2026-10-11 第 3 步
//
// 把原本只存在于老板脑子里的运营常识搬到界面上：
//   哪些账号在运营、客服几点上下班、休息窗口在哪、谁周几休息。
//
// 为什么只开放「账号状态」和「排班」两个开关：
//   这两个会变（开新号、调休），其余一年动两次（换季），先只读。
//   把所有东西都做成可编辑 = 四倍的 UI 和四倍的出错面，不划算。

import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { roleLabel } from '../../utils/roles'
import { currentSeason, tzGapHours, sydneyToBeijing, isWorkingOn } from '../../utils/shifts'
import { Radio, Clock, Coffee, CalendarDays, AlertTriangle } from 'lucide-react'
import AddChannelAccount from '../../components/AddChannelAccount'

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const STATUS = {
  active:  { label: '运营中', cls: 'bg-green-100 text-green-700' },
  planned: { label: '计划中', cls: 'bg-gray-100 text-gray-500' },
  paused:  { label: '已暂停', cls: 'bg-amber-100 text-amber-700' },
}

export default function SettingsOperations() {
  const { config, staff, updateChannelAccount, updateStaffSchedule, addChannelAccount, deleteChannelAccount, channelUsage } = useApp()
  const [busy, setBusy] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [err, setErr] = useState('')

  const { channelAccounts, shiftConfigs, breakWindows, staffSchedules } = config
  const season = currentSeason()
  const gap = tzGapHours()
  const shift = shiftConfigs.find(s => s.season === season)

  if (channelAccounts.length === 0 && shiftConfigs.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-amber-800">运营配置还没初始化</p>
          <p className="text-amber-700 mt-1 leading-relaxed">
            需要先在 Supabase 跑一次
            <code className="mx-1 px-1.5 py-0.5 bg-white rounded text-xs">
              2026_10_11_config_tables.sql
            </code>
            。跑完刷新本页即可，不影响其他功能。
          </p>
        </div>
      </div>
    )
  }

  async function run(key, fn) {
    setBusy(key); setErr('')
    try { await fn() } catch (e) { setErr(e.message || '保存失败') } finally { setBusy('') }
  }

  // 每个星期几有几个人在岗。1 人 = 单人日，下午那段休息不排。
  // 判断复用 utils/shifts 的 isWorkingOn —— 同一个规则不要在组件里再写一遍，
  // 否则以后改规则会漏掉这里。
  //
  // ⚠️ 2026-10-16：这里【故意不传 roster】。
  //    这块展示的是「按星期规则每天几个人」，也就是规则本身；
  //    而 shift_roster 是某一天的实际排班（含补休、临时调整）。
  //    这两者不该混 —— 这里混进实际排班，规则预览就会随着某天的调整跳动。
  //    其余所有「谁在岗」的判断都已改为优先读 shift_roster（唯一真相）。
  const staffIds = [...new Set(staffSchedules.map(s => s.staff_id))]
  const headcount = WEEK.map((_, dow) => {
    // 硬编码一周样本日期（2026-10-11 是周日，和 dow 0=周日 对齐）。
    // 只用来取星期几，不依赖具体日期。
    const probe = ['2026-10-11','2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17'][dow]
    return staffIds.filter(id => isWorkingOn(staffSchedules, id, probe)).length
  })

  return (
    <div className="space-y-5">
      {err && <p className="text-red-600 text-sm font-medium">{err}</p>}

      {/* ── 运营账号 ───────────────────────────────── */}
      <Block icon={Radio} title="运营账号"
        hint="「运营中」的账号每天必须登记咨询数；「计划中」的在登记表里灰显不必填。以后开新号在这里加，不用找人改代码">
        <div className="divide-y divide-gray-100">
          {channelAccounts.map(a => editing === a.id ? (
            <EditAccount key={a.id} account={a} staff={staff} busy={busy === a.id}
              onCancel={() => setEditing(null)}
              onSave={async v => { await run(a.id, () => updateChannelAccount(a.id, v)); setEditing(null) }} />
          ) : (
            <div key={a.id} className="flex items-center gap-3 py-2.5">
              <span className="text-xs text-gray-400 w-12 shrink-0">{a.platform}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-800">{a.name}</p>
                {a.positioning && <p className="text-xs text-gray-400 truncate">{a.positioning}</p>}
                {/* 老板 10-18：谁管这个号 —— 决定这个号出现在谁的「今天要发」
                    和谁的咨询登记表里。空着＝公共的，谁都要登记。 */}
                <p className="text-xs text-gray-400">
                  负责人：{a.owner_staff_id
                    ? (staff?.find?.(x => x.id === a.owner_staff_id)?.name || a.owner_staff_id)
                    : <span className="text-gray-300">没指定（谁都要登记）</span>}
                </p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded shrink-0 ${STATUS[a.status]?.cls}`}>
                {STATUS[a.status]?.label || a.status}
              </span>
              <button disabled={busy === a.id} onClick={() => setEditing(a.id)}
                className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 shrink-0">改</button>
              <button
                disabled={busy === a.id}
                onClick={() => run(a.id, () => updateChannelAccount(a.id,
                  { status: a.status === 'active' ? 'planned' : 'active' }))}
                className="text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 shrink-0"
              >
                {a.status === 'active' ? '停用' : '启用'}
              </button>
              <button disabled={busy === a.id}
                onClick={async () => {
                  // 删之前先查清楚要删什么 —— 不能让人盲删
                  const u = await channelUsage(a.id)
                  if (!u.inquiries && !u.posts) {
                    if (confirm(`删除「${a.name}」？\n\n它没有任何登记记录，删掉不影响任何数据。`))
                      run(a.id, () => deleteChannelAccount(a.id))
                    return
                  }
                  const msg = `「${a.name}」有 ${u.inquiries} 条咨询登记（共 ${u.people} 人）`
                    + `、${u.posts} 条发布记录${u.firstDate ? `，最早 ${u.firstDate}` : ''}。\n\n`
                    + `建议改成「停用」—— 它会从每日登记里消失，但这些历史数据还查得到。\n\n`
                    + `确定要【连同这些记录一起删掉】吗？删了就找不回来了。`
                  if (confirm(msg)) run(a.id, () => deleteChannelAccount(a.id, true))
                }}
                className="text-xs px-2 py-1 rounded-lg text-gray-300 hover:text-red-600 disabled:opacity-40 shrink-0">删</button>
            </div>
          ))}
        </div>
        {/* 老板 10-12：「以后可能还有增加的运营平台或者账户怎么办」——
            账号名在代码里一个字都没写死，一直是从这张表读的，
            缺的只是新增入口。补上。 */}
        {adding ? (
          <AddChannelAccount busy={!!busy} onCancel={() => setAdding(false)}
            onAdd={async v => { await run('new', () => addChannelAccount(v)); setAdding(false) }} />
        ) : (
          <button onClick={() => setAdding(true)}
            className="mt-3 w-full border border-dashed border-gray-300 rounded-xl py-2 text-sm text-gray-500 hover:border-red-300 hover:text-red-600">
            + 新增运营账号
          </button>
        )}
      </Block>

      {/* ── 班次 ─────────────────────────────────── */}
      <Block icon={Clock} title="客服班次"
        hint={`当前按${season === 'summer' ? '夏令时' : '冬令时'}执行 · 悉尼比北京快 ${gap} 小时（实时查时区库，不写死）`}>
        {shift ? (
          <div className="grid grid-cols-2 gap-3">
            <Cell label="悉尼时间" value={`${shift.start_time?.slice(0,5)} – ${shift.end_time?.slice(0,5)}`} />
            <Cell label="客服本地（北京）"
              value={`${sydneyToBeijing(shift.start_time)} – ${sydneyToBeijing(shift.end_time)}`} accent />
            <Cell label="休息" value={`${shift.break_count} 段 × ${shift.break_minutes} 分钟`} />
            <Cell label="超时提醒" value={`超 ${shift.overtime_alert_minutes} 分钟提醒本人和 Annie`} />
          </div>
        ) : <p className="text-sm text-gray-400">没有 {season} 的班次配置</p>}
        <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-dashed border-gray-200">
          换季自动切（澳洲 10 月第一个周日入夏令时、4 月第一个周日退）。要改时间请跑 SQL ——
          一年只动两次，不值得做成可编辑。
        </p>
      </Block>

      {/* ── 休息窗口 ─────────────────────────────── */}
      <Block icon={Coffee} title="休息窗口"
        hint="给范围不给钟点 —— 两人在窗口内自己挑，先点先占，另一人看到是灰的">
        <div className="space-y-2">
          {breakWindows.filter(w => w.season === season).sort((a,b) => a.slot_index - b.slot_index).map(w => (
            <div key={w.slot_index} className="flex items-center gap-3 text-sm">
              <span className="w-16 font-semibold text-gray-700 shrink-0">{w.slot_name}</span>
              <span className="font-mono text-gray-600">
                {w.window_start?.slice(0,5)} – {w.window_end?.slice(0,5)}
              </span>
              <span className="text-xs text-gray-400">北京时间 · 挑 {w.duration_min} 分钟</span>
              {!w.single_day && (
                <span className="ml-auto text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded shrink-0">
                  单人日不排
                </span>
              )}
            </div>
          ))}
        </div>
      </Block>

      {/* ── 排班 ─────────────────────────────────── */}
      <Block icon={CalendarDays} title="客服排班" hint="点格子切换。只有 1 人在岗的那天，下午那段休息自动不排">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left font-medium text-xs text-gray-400 pb-2 pr-2" />
                {WEEK.map(d => <th key={d} className="font-medium text-xs text-gray-400 pb-2 px-1">{d}</th>)}
                <th className="font-medium text-xs text-gray-400 pb-2 pl-2">在岗</th>
              </tr>
            </thead>
            <tbody>
              {staffIds.map(id => {
                const who = staff.find(s => s.id === id)
                const days = WEEK.map((_, dow) => {
                  const r = staffSchedules.find(s => s.staff_id === id && s.weekday === dow)
                  return r ? r.is_working : true
                })
                return (
                  <tr key={id}>
                    <td className="pr-2 py-1">
                      <p className="font-semibold text-gray-800 whitespace-nowrap">{who?.name || id}</p>
                      <p className="text-xs text-gray-400">{roleLabel(who?.role)}</p>
                    </td>
                    {days.map((on, dow) => (
                      <td key={dow} className="px-1 py-1 text-center">
                        <button
                          disabled={busy === `${id}-${dow}`}
                          onClick={() => run(`${id}-${dow}`, () => updateStaffSchedule(id, dow, !on))}
                          className={`w-9 h-9 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 ${
                            on ? 'bg-red-50 text-red-700 hover:bg-red-100'
                               : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                        >{on ? '●' : '休'}</button>
                      </td>
                    ))}
                    <td className="pl-2 text-xs text-gray-500 whitespace-nowrap">
                      {days.filter(Boolean).length} 天
                    </td>
                  </tr>
                )
              })}
              <tr>
                <td className="pr-2 pt-2 text-xs text-gray-400">在岗人数</td>
                {headcount.map((n, i) => (
                  <td key={i} className="px-1 pt-2 text-center">
                    <span className={`text-xs font-semibold ${n <= 1 ? 'text-amber-600' : 'text-gray-500'}`}>
                      {n}{n <= 1 && ' 单'}
                    </span>
                  </td>
                ))}
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </Block>
    </div>
  )
}

function EditAccount({ account, staff, onSave, onCancel, busy }) {
  const [v, setV] = useState({ platform: account.platform, name: account.name,
    positioning: account.positioning || '', owner_staff_id: account.owner_staff_id || '' })
  const set = (k, x) => setV(p => ({ ...p, [k]: x }))
  // 只列后台的人 —— 师傅不运营账号
  const candidates = (staff || []).filter(x => x.active !== false && x.role !== 'worker')
  return (
    <div className="py-2.5 flex items-center gap-2 flex-wrap">
      <input value={v.platform} onChange={e => set('platform', e.target.value)} placeholder="平台"
        className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-red-400" />
      <input value={v.name} onChange={e => set('name', e.target.value)} placeholder="账号名"
        className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-red-400" />
      <input value={v.positioning} onChange={e => set('positioning', e.target.value)} placeholder="定位"
        className="flex-1 min-w-32 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-red-400" />
      <select value={v.owner_staff_id} onChange={e => set('owner_staff_id', e.target.value || null)}
        title="谁管这个号 —— 决定它出现在谁的「今天要发」和咨询登记表里"
        className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-red-400 shrink-0">
        <option value="">负责人：不指定</option>
        {candidates.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <span className="text-xs text-gray-300 font-mono shrink-0">{account.id}</span>
      <button onClick={onCancel} className="px-2 py-1.5 text-sm text-gray-500 shrink-0">取消</button>
      <button disabled={busy || !v.name.trim()} onClick={() => onSave(v)}
        className="px-3 py-1.5 rounded-lg text-white text-sm font-semibold disabled:opacity-40 shrink-0"
        style={{ background: 'linear-gradient(135deg,#6b1414,#c0392b)' }}>保存</button>
    </div>
  )
}

function Block({ icon: Icon, title, hint, children }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className="text-red-700" />
        <h2 className="font-bold text-gray-900">{title}</h2>
      </div>
      {hint && <p className="text-xs text-gray-400 mb-3 leading-relaxed">{hint}</p>}
      {children}
    </div>
  )
}

function Cell({ label, value, accent }) {
  return (
    <div className={`rounded-xl px-3 py-2 ${accent ? 'bg-red-50' : 'bg-gray-50'}`}>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`font-mono font-semibold text-sm mt-0.5 ${accent ? 'text-red-700' : 'text-gray-800'}`}>{value}</p>
    </div>
  )
}
