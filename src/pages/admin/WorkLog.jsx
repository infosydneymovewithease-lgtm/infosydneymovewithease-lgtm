// 客服工作台 · 我的日报 —— 2026-10-12 第 5 步
//
// 客服每天填这一页；Annie 的团队视图读同一份数据。
// 只填一次，两处都能用 —— 绝不做两套查询，那是数字对不上的开始。
//
// 真正要动手写的只有三项：发布内容 / 主动开发 / 问题。
// 出勤点一下，业绩系统自己算，平台咨询填个数字。

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { sydneyToday } from '../../utils/date'
import { currentSeason, tzGapHours } from '../../utils/shifts'
import {
  slotsForDay, startOptions, othersOnBreak, myBreak, breakMinutes,
  requiredAccounts, inquiryProgress, myPerformance, weeklyVideo, weekRange,
} from '../../utils/worklog'
import { LogIn, LogOut, Coffee, Plus, Trash2, Check } from 'lucide-react'
import AddChannelAccount from '../../components/AddChannelAccount'

const hhmm = iso => iso
  ? new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  : '—'
const money = n => `$${(Number(n) || 0).toFixed(2)}`

export default function WorkLog() {
  const {
    user, staff, orders, config,
    getWorkday, upsertWorkLog, startBreak, endBreak, saveInquiry, addPost, deletePost, getPolicyText,
    addChannelAccount, updateChannelAccount, deleteChannelAccount, channelUsage,
  } = useApp()
  const navigate = useNavigate()
  const date = sydneyToday()
  const [day, setDay] = useState({ logs: [], breaks: [], inquiries: [], posts: [] })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [, setTick] = useState(0)
  const [policy, setPolicy] = useState({})
  const [adding, setAdding] = useState(false)
  const [quickFill, setQuickFill] = useState(false)
  const [editRow, setEditRow] = useState(null)

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
    () => inquiryProgress(config.channelAccounts, day.inquiries, date, user?.id),
    [config.channelAccounts, day.inquiries, date, user?.id])
  const perf = useMemo(() => myPerformance(orders, user?.id, date), [orders, user?.id, date])
  const wk = weekRange(date)
  const video = weeklyVideo(day.posts, wk.from, wk.to)
  const others = othersOnBreak(day.breaks, user?.id)
  const adds = mine?.wechat_adds ?? null
  const isManager = user?.role === 'admin' || user?.role === 'manager'
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
      {/* 浮在屏幕上，不随页面滚走 ——
          老板 10-13 在页面中间填数字保存失败，报错在最顶部，他根本看不见，
          只看到「数字不联动」。错误提示必须出现在视线里。 */}
      {err && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[90%]
                        bg-red-600 text-white rounded-xl px-4 py-3 shadow-lg flex items-start gap-2">
          <span className="shrink-0">⚠️</span>
          <span className="text-sm flex-1 leading-relaxed">{err}</span>
          <button onClick={() => setErr('')} className="shrink-0 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

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
      <div id="inquiry-section" className="scroll-mt-4" />
      <Card title="平台咨询登记" hint="7 个触点每天逐个检查，填你自己接待的人数。今天 0 个也要登记 —— 填 0 就行，不填不算。左边显示你在「今天发了什么」里登记的内容，不用重复填。鼠标移到行上，右边 ✕ 可以删掉这个号">
        <div className="space-y-1.5">
          {(config.channelAccounts || []).map(a => {
            // 只显示自己填的 —— 两个人在岗时各填各的
            const rec = day.inquiries.find(i => i.account_id === a.id && i.staff_id === user?.id)
            const myPosts = day.posts.filter(p => p.account_id === a.id && p.posted_by === user?.id)
            const planned = a.status !== 'active'
            const done = !!rec
            // 老板 10-13：「删除或更改某一条信息」—— 每行要能改也能删，
            // 在看到它的地方处理，不用跑去设置页。只对 admin/manager 开放。
            if (editRow === a.id) return (
              <RowEdit key={a.id} account={a} busy={busy}
                onCancel={() => setEditRow(null)}
                onSave={async v => { await run(() => updateChannelAccount(a.id, v)); setEditRow(null) }} />
            )
            return (
              <div key={a.id} className="flex items-center gap-3 py-1">
                <span className="w-2 h-2 rounded-full shrink-0" style={{
                  background: planned ? '#d1d5db' : done ? '#22c55e' : '#f59e0b' }} />
                <span className="text-xs text-gray-400 w-12 shrink-0">{a.platform}</span>
                <span className={`text-sm w-20 shrink-0 ${planned ? 'text-gray-400' : 'font-semibold'}`}>{a.name}</span>
                <span className="text-xs text-gray-400 flex-1 truncate min-w-0">{a.positioning}</span>
                {/* 老板 10-13：「删除或更改某一条信息」——
                    在看到它的地方改和删，不用跑去设置页。
                    只对 admin/manager 开放（改一个号影响全员每天的登记表）。 */}
                {isManager && (
                  <span className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => setEditRow(a.id)} title={`改「${a.name}」`}
                      className="text-xs text-gray-200 hover:text-gray-600 px-1">改</button>
                    <button title={`删除「${a.name}」`}
                      onClick={async () => {
                        const u = await channelUsage(a.id)
                        const msg = (!u.inquiries && !u.posts)
                          ? `删除「${a.name}」？\n\n它没有任何登记记录，删掉不影响任何数据。`
                          : `「${a.name}」有 ${u.inquiries} 条咨询登记（共 ${u.people} 人）、${u.posts} 条发布记录`
                            + `${u.firstDate ? `，最早 ${u.firstDate}` : ''}。\n\n`
                            + `如果只是暂时不运营，点「改」把状态设成未开通更合适 —— 历史还查得到。\n\n`
                            + `确定要连同这些记录一起删掉吗？删了就找不回来了。`
                        if (confirm(msg)) run(() => deleteChannelAccount(a.id, !!(u.inquiries || u.posts)))
                      }}
                      className="text-xs text-gray-200 hover:text-red-600 px-1">✕</button>
                  </span>
                )}
                {planned ? (
                  <span className="text-xs text-gray-300 w-24 text-right shrink-0">未开通</span>
                ) : (
                  <>
                    {/* 凭证直接读「今天发了什么」里登记的内容 —— 不让人填两遍。
                        老板 10-12 指出这两处是同一件事，确实是我做重复了。 */}
                    <span className="text-xs w-44 truncate shrink-0 text-right">
                      {myPosts.length
                        ? <span className="text-gray-500">
                            {myPosts[0].kind === 'video' ? '🎬' : '📝'} {myPosts[0].title || '（没写标题）'}
                            {myPosts.length > 1 && ` 等 ${myPosts.length} 条`}
                          </span>
                        : <span className="text-gray-300">今天没登记发布</span>}
                    </span>
                    <input type="number" min="0" step="1" placeholder="待填"
                      defaultValue={rec?.count ?? ''}
                      onBlur={e => { if (e.target.value !== '') run(() => saveInquiry(date, a.id, e.target.value)) }}
                      className={`w-20 border rounded-lg px-2 py-1 text-sm font-mono text-right outline-none focus:border-red-400 shrink-0 ${
                        done ? 'border-green-200 bg-green-50' : 'border-amber-300 bg-amber-50'}`} />
                  </>
                )}
              </div>
            )
          })}
        </div>
        {/* 老板 10-12：这里要能直接加新平台（抖音、新号…）。
            ⚠️ 只对 admin/manager 显示 —— 加一个账号 = 全团队从此每天必填，
               而且和真实性声明、罚款挂着，那是管理决定不是客服决定。 */}
        {isManager && (
          adding ? (
            <AddChannelAccount busy={busy} onCancel={() => setAdding(false)}
              onAdd={async v => { await run(() => addChannelAccount(v)); setAdding(false) }} />
          ) : (
            <div className="flex gap-2 mt-3">
              <button onClick={() => setAdding(true)}
                className="flex-1 border border-dashed border-gray-300 rounded-xl py-2 text-sm text-gray-500 hover:border-red-300 hover:text-red-600">
                + 新增运营平台 / 账号
              </button>
              {/* 老板 10-13 在这一页找删除按钮没找到 —— 加个去处，
                  而不是让他满界面翻。改和删放在系统设置是对的（低频、影响全员），
                  但得从这里能过去。 */}
              <button onClick={() => navigate('/admin/settings?tab=ops')}
                className="px-3 border border-dashed border-gray-300 rounded-xl py-2 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 whitespace-nowrap">
                改名 / 停用
              </button>
            </div>
          )
        )}

        <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100 text-sm">
          <span className="text-gray-500">我今天接待合计</span>
          <span className="font-mono font-bold text-lg">{prog.total} 人</span>
        </div>
        {!prog.ok && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-2">
            ⚠️ 还差 {prog.missing.map(a => a.name).join('、')} 没登记 —— 填完才能提交日报、才能下班
          </p>
        )}
      </Card>

      {/* ── 今天接待多少、下单几个 ───────────────
           老板 10-12：「我们需要了解的主要东西是今天客服一共接待了多少人，
           下单几个」—— 这是整页最重要的一行，不该拆在两张卡片里。 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h2 className="font-bold text-gray-900 text-sm mb-3">今天接待了多少 · 下了几单</h2>
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* 老板 10-12/13 两次反馈：先是「写了手填但点不动」，
              改成跳转后又说「只是希望在我接待那里点选填写」——
              要的是【就地填】。合计是 7 个平台的和，不能只填一个总数
              （那就失去逐个检查的意义），所以点一下在原地展开小面板。 */}
          {/* 三段漏斗（老板 10-13 指出的「应接待 vs 实际接待」）：
              平台上有人问 → 真的加了微信 → 下单。
              中间那一跳的流失率才是有用的 —— 问了 20 个只加 5 个，
              说明文案或回复有问题。混成一个数就看不出来。 */}
          <Big label="平台咨询" value={prog.total} unit="人" tag={quickFill ? '收起' : '点这里填'}
            sub={prog.ok ? `${prog.need.length} 个平台都登记了` : `还差 ${prog.missing.length} 个`}
            onClick={() => setQuickFill(v => !v)} />
          <Arrow />
          <Big label="加微信" value={adds} unit="人" tag="手填" accent
            sub={prog.total > 0 && adds != null ? `平台来的留下 ${Math.round(adds / prog.total * 100)}%` : '微信今天新增好友'}
            onClick={() => document.getElementById('wechat-adds')?.focus()} />
          <Arrow />
          <Big label="下单" value={perf.booked} unit="单" tag="自动"
            sub={adds > 0 ? `加微信的成了 ${Math.round(perf.booked / adds * 100)}%` : '你今天建的单'} />
        </div>

        {/* 实际接待 —— 一个数，不分平台 */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
          <span className="text-sm text-gray-600 shrink-0">今天微信加了几个人</span>
          <input id="wechat-adds" type="number" min="0" step="1" placeholder="待填"
            defaultValue={mine?.wechat_adds ?? ''}
            onBlur={e => { if (e.target.value !== '') run(() => upsertWorkLog(date, { wechat_adds: Number(e.target.value) })) }}
            className={`w-24 border rounded-lg px-2 py-1 text-sm font-mono text-right outline-none focus:border-red-400 shrink-0 ${
              adds != null ? 'border-green-200 bg-green-50' : 'border-amber-300 bg-amber-50'}`} />
          <span className="text-xs text-gray-400 flex-1 min-w-0">
            这是<b>实际接待</b> —— 真的加上「迁喜生活服务」的人。
            平台上问了但没加的不算，那部分流失正是要看的
          </span>
        </div>
        {/* 就地填 —— 不用滚到下面的登记表 */}
        {quickFill && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
            {prog.need.map(a => {
              const rec = day.inquiries.find(i => i.account_id === a.id && i.staff_id === user?.id)
              return (
                <div key={a.id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-10 shrink-0">{a.platform}</span>
                  <span className="text-sm font-semibold w-20 shrink-0">{a.name}</span>
                  <span className="text-xs text-gray-400 flex-1 truncate min-w-0">{a.positioning}</span>
                  <input type="number" min="0" step="1" placeholder="待填"
                    defaultValue={rec?.count ?? ''}
                    onBlur={e => { if (e.target.value !== '') run(() => saveInquiry(date, a.id, e.target.value)) }}
                    className={`w-20 border rounded-lg px-2 py-1 text-sm font-mono text-right outline-none focus:border-red-400 shrink-0 ${
                      rec ? 'border-green-200 bg-green-50' : 'border-amber-300 bg-amber-50'}`} />
                </div>
              )
            })}
            <p className="text-xs text-gray-400 pt-1">
              今天 0 个也要填 0 —— 空着不算登记。未开通的号在下面的登记表里，这里不显示
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-gray-100">
          <Stat label="接单金额" value={money(perf.bookedAmount)} />
          <Stat label="今天搬的（我接的）" value={`${perf.served} 单`} />
          <Stat label="完成金额" value={money(perf.servedAmount)} />
        </div>
        <p className="text-xs text-gray-400 mt-2 leading-relaxed">
          <b>两个数要你填</b>：平台咨询（分平台登记）和加微信人数。
          微信、小红书里发生的事系统看不见，只能你报。<br />
          「下单」和下面三个金额都是系统按你的账号自动算的，不用管。
          多数单几天后才搬，所以「今天搬的」和「今天下单的」不是同一批。
        </p>
      </div>

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

      {/* 老板 10-13：「这个是今天的总问题，期待改进相关问题，
          也告诉她们这个是除了我他人不可见的，公司会整理在每周的会议上提出」 */}
      <Card title="今天的问题 · 想改进的地方">
        <div className="bg-blue-50 rounded-xl px-3 py-2.5 mb-2.5">
          <p className="text-sm text-blue-900 font-medium">🔒 这一栏只有老板能看到</p>
          <p className="text-xs text-blue-700 mt-1 leading-relaxed">
            客服经理和其他同事都看不到你写的内容。<br />
            公司会把大家提的问题整理出来，<b>在每周例会上提出讨论</b>。
            有什么不顺手的、觉得该改的，直接写。
          </p>
        </div>
        <textarea rows={3} defaultValue={mine?.issues || ''}
          placeholder={'今天遇到的问题，或者你觉得该改进的地方。例如：\n· 盼达号有客人问长途报价，我不确定该怎么回\n· 派单后师傅没收到通知，我又打电话确认了一遍\n· 希望能批量改订单时间，现在一单一单改太慢'}
          onBlur={e => run(() => upsertWorkLog(date, { issues: e.target.value }))}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400 resize-none leading-relaxed" />
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

function RowEdit({ account, onSave, onCancel, busy }) {
  const [v, setV] = useState({
    platform: account.platform, name: account.name,
    positioning: account.positioning || '', status: account.status,
  })
  const set = (k, x) => setV(p => ({ ...p, [k]: x }))
  return (
    <div className="flex items-center gap-2 py-2 flex-wrap bg-gray-50 rounded-lg px-2 -mx-2">
      <input value={v.platform} onChange={e => set('platform', e.target.value)} placeholder="平台"
        className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-red-400" />
      <input value={v.name} onChange={e => set('name', e.target.value)} placeholder="账号名" autoFocus
        className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-red-400" />
      <input value={v.positioning} onChange={e => set('positioning', e.target.value)} placeholder="定位"
        className="flex-1 min-w-28 border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-red-400" />
      {[['active', '运营中'], ['planned', '未开通']].map(([s, l]) => (
        <button key={s} onClick={() => set('status', s)}
          className={`px-2 py-1 rounded-lg text-xs font-semibold border shrink-0 ${
            v.status === s ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'}`}>{l}</button>
      ))}
      <span className="text-xs text-gray-300 font-mono shrink-0">{account.id}</span>
      <button onClick={onCancel} className="px-2 py-1 text-sm text-gray-500 shrink-0">取消</button>
      <button disabled={busy || !v.name.trim()} onClick={() => onSave(v)}
        className="px-3 py-1 rounded-lg text-white text-sm font-semibold disabled:opacity-40 shrink-0"
        style={{ background: 'linear-gradient(135deg,#6b1414,#c0392b)' }}>保存</button>
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

function Big({ label, value, unit, sub, accent, tag, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick}
      className={`flex-1 min-w-0 text-left ${onClick ? 'rounded-lg -m-1 p-1 hover:bg-amber-50 transition-colors' : ''}`}>
      <p className="text-xs text-gray-400 flex items-center gap-1">
        {label}
        {tag && (
          <span className={`text-xs px-1 py-0.5 rounded leading-none ${
            tag === '自动' ? 'bg-gray-100 text-gray-400' : 'bg-amber-100 text-amber-700'}`}>{tag}</span>
        )}
      </p>
      <p className={`font-mono font-bold leading-none mt-1 ${accent ? 'text-red-700' : 'text-gray-900'}`}>
        <span className="text-3xl">{value == null ? '—' : value}</span>
        <span className="text-sm ml-0.5 font-normal">{value == null ? '' : unit}</span>
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1 truncate">{sub}</p>}
    </Tag>
  )
}

function Arrow() {
  return <span className="text-gray-300 text-xl shrink-0">→</span>
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
