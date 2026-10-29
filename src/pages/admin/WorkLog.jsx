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
import { sydneyToday, addDays, sydneyDateOf, weekdayOf } from '../../utils/date'
import { currentSeason, tzGapHours } from '../../utils/shifts'
import {
  requiredAccounts, myChannels, ownsAccount, inquiryProgress, myPerformance, weeklyVideo, weekRange,
  opsDateFor, opsCanEdit, opsOverdue,
} from '../../utils/worklog'
import { myEditsToday, weekOutput } from '../../utils/content'
import { Plus, Check } from 'lucide-react'
import AddChannelAccount from '../../components/AddChannelAccount'
import AttendanceCard from '../../components/AttendanceCard'
import { uploadImage } from '../../utils/upload'

const hhmm = iso => iso
  ? new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  : '—'
const money = n => `$${(Number(n) || 0).toFixed(2)}`

const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export default function WorkLog() {
  const {
    user, orders, config, staff,
    getWorkday, upsertWorkLog, saveInquiry, addPost, getPolicyText,
    addChannelAccount, updateChannelAccount, deleteChannelAccount, channelUsage,
    listWorkLogReturns, pendingReturns, getContentRange, openDays, logBackfill, getInquiryWeek,
  } = useApp()
  const navigate = useNavigate()
  // ⚠️ 默认今天。只有【被退回的日子】可以切过去改 ——
  //    不给自由日期选择器：那等于开了补填口子，她可以周五把
  //    周一到周四空着的日报全补上，「当下填写」就全废了。
  const today = sydneyToday()
  const [date, setDate] = useState(today)
  const [pending, setPending] = useState([])   // 被退回还没改完的日子
  // 管理员补录。老板 10-24 选的方案③ —— 只给 admin 开自由选日期的口子，
  // 每次写原因并进 audit_log。客服那边的「当下填写」一点没松。
  const [backfill, setBackfill] = useState(null)   // { date, reason } 或 null
  const [backfillReason, setBackfillReason] = useState('')  // 进入补录时填的原因，顶上一直显示
  const editingPast = date !== today
  const [day, setDay] = useState({ logs: [], breaks: [], inquiries: [], posts: [] })
  // ⚠️ 2026-10-30 T+1：这份日报收的【运营数据】是前一天的。
  //    老板 10-29：「事实上我们没有办法当天确认小红书的具体人数」——
  //    那个数当天物理上不存在，以前逼人当天填，只能瞎填或者空着交不了。
  //    所以这一页要同时装两天：今天的出勤/评论/问题 + 昨天的咨询/加微信。
  const opsDate = opsDateFor(date)
  const [opsDay, setOpsDay] = useState({ logs: [], breaks: [], inquiries: [], posts: [] })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [, setTick] = useState(0)
  const [policy, setPolicy] = useState({})
  const [adding, setAdding] = useState(false)
  const [quickFill, setQuickFill] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [returns, setReturns] = useState([])
  const [extraAdd, setExtraAdd] = useState(false)
  const [content, setContent] = useState({ slots: [], items: [] })
  const [openD, setOpenD] = useState([])
  const [overdue, setOverdue] = useState([])   // 超期没人登记的日子（只有老板看）

  // 两天一起刷 —— 咨询存在昨天那一天，不一起刷的话填完数字原地不变
  const refresh = useCallback(async () => {
    const [d, o] = await Promise.all([getWorkday(date), getWorkday(opsDate)])
    setDay(d); setOpsDay(o)
  }, [getWorkday, date, opsDate])
  useEffect(() => {
    let alive = true
    ;(async () => {
      const [d, o] = await Promise.all([getWorkday(date), getWorkday(opsDate)])
      if (alive) { setDay(d); setOpsDay(o) }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])
  useEffect(() => { getPolicyText().then(setPolicy) /* eslint-disable-next-line */ }, [])
  // 超期未登记 —— 老板 10-30：「他那里超期没有不写，那我的后台要有提示了」
  // 过了期限的日子不再占客服的待办，但缺口不能就这么消失，它落到这里。
  // ⚠️ 只有 admin 拉这份数据 —— 别人看了也没用，还多一次请求。
  useEffect(() => {
    if (user?.role !== 'admin') return
    getInquiryWeek(addDays(today, -21), today)
      .then(rows => setOverdue(opsOverdue(config.channelAccounts, rows, today)))
    // eslint-disable-next-line
  }, [today, user?.role, config.channelAccounts])
  // 被经理退回过就要看到原因，否则她不知道该改哪里
  useEffect(() => { listWorkLogReturns(date, date).then(setReturns) /* eslint-disable-next-line */ }, [date])
  useEffect(() => { pendingReturns(addDays(today, -14)).then(setPending) /* eslint-disable-next-line */ }, [today, date])
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
  const prog = useMemo(
    // ⚠️ 这里不能用下面的 isBoss / backfillMode —— 它们声明在后面，
    //    写进依赖数组就是 TDZ 白屏（之前栽过一次）。所以内联算。
    // 最后那个参数＝补录模式：别人填过的号就算填了，不要求老板再填一遍。
    () => inquiryProgress(config.channelAccounts, opsDay.inquiries, opsDate, user?.id,
      user?.role === 'admin', user?.role === 'admin' && date !== today),
    [config.channelAccounts, opsDay.inquiries, opsDate, date, user?.id, user?.role, today])
  const perf = useMemo(() => myPerformance(orders, user?.id, date), [orders, user?.id, date])
  // 漏斗三段必须同一天才有意义：咨询和加微信都是昨天的，下单也取昨天的。
  // 否则「昨天问了 20 个 / 今天下了 3 单」这个百分比算出来是假的。
  const opsPerf = useMemo(() => myPerformance(orders, user?.id, opsDate), [orders, user?.id, opsDate])
  const wk = weekRange(date)
  const video = weeklyVideo(day.posts, wk.from, wk.to)
  // 加微信人数跟着咨询一起挪到昨天 —— 咨询→加微信→下单是一条漏斗，
  // 分母在昨天分子在今天，这个转化率就是假的。存在【昨天那一行】，
  // 所以周月汇总不用改一行代码，日期本来就是对的。
  const opsMine = opsDay.logs.find(l => l.staff_id === user?.id)
  const adds = opsMine?.wechat_adds ?? null
  const isManager = user?.role === 'admin' || user?.role === 'manager'
  // 老板两边都管，而且他是唯一要检查客服那张卡长什么样的人 —— 看不到就没法验。
  // 所以三档：客服只看小红书、经理只看企业开发、老板两个都看（都不卡他）。
  const isBoss    = user?.role === 'admin'

  // 经理的产出是「做出来的内容」，不是「发出去的条数」—— 取本周排期来算
  useEffect(() => {
    // ⚠️ 2026-10-18 对调后：内容数据【人人都要】——
    //    制作归客服，她的「今天编辑了什么」要靠这份数据。
    //    原来写的是 !isManager 就 return，对调后小洁那张卡会永远是空的。
    const wk = weekRange(date)
    getContentRange(wk.from, wk.to).then(setContent)
    if (!isManager) return
    // 老板 10-15：「经理应该是早上先核对账目吧，这个应该加到经理的日报里」
    // 按他定的 T+1 流程，她早上核的是【昨天】的账和客服日报。
    // 这两件事原来只在「团队今日」「每日对账」里，日报上一点痕迹没有。
    openDays(addDays(date, -7), addDays(date, -1)).then(setOpenD)
    // eslint-disable-next-line
  }, [date, isManager])
  const quota = Number(policy.comment_quota) || 3
  const commentCount = mine?.comment_count ?? 0
  // 客服要达配额才能提交；经理没有日配额（to B 开发按天算没意义）
  const commentOk = isManager || commentCount >= quota
  // 老板 10-13：「每人每天至少一条，内容不限」—— 和小红书配额同一个道理，
  // 不指望人主动提问题，给个下限。内容不限，所以「今天挺顺的」也算一条。
  // 老板自己不填（这一栏是写给他看的）。
  const issuesOk = isBoss || !!String(mine?.issues || '').trim()
  const gap = tzGapHours()

  const myReturns = returns.filter(r => r.staff_id === user?.id)
  const staffName = id => staff?.find?.(x => x.id === id)?.name || id
  const nameOfAccount = id => (config.channelAccounts || []).find(a => a.id === id)?.name || id

  const [truth, setTruth] = useState(false)
  // ⚠️ 补录模式不要求打卡。老板 10-24：
  //    「昨天已经过去了，我只能补录昨天我知道的数据，补录完成我应该是可以提交的」
  //    他 10/23 本来就没上班，现在也补不出一个打卡记录来 —— 要求打卡等于
  //    逼他造一条假出勤。补录是管理动作，不是报自己的工。
  //    ⚠️ 只对 admin 的补录放开（backfillMode），客服和经理一点没松。
  const backfillMode = isBoss && editingPast
  const clockOk = backfillMode || !!mine?.clock_in

  // ── 昨天那块数据，现在还轮得到我填吗 ──────────────────────
  // 老板 10-30 定的三档：客服只能填昨天、经理能补到前天、老板不限。
  // ⚠️ 前端只管「显不显示输入框」。真正拦住的是数据库函数 save_inquiry ——
  //    前端有 bug 也绕不过去，这条规矩从第一版起就没变过。
  const opsEditable = opsCanEdit(opsDate, today, user?.role)
  // 昨天我在岗吗 —— 用「有没有打卡记录」判断，不另外去拉排班表。
  // 周一打开日报，昨天是周日她根本没上班，不该因为周日的小红书没人填
  // 就卡住她周一的日报。Annie 周末休，周六的小红书老板 10-30 说他自己管。
  const workedOps = !!opsDay.logs.find(l => l.staff_id === user?.id)?.clock_in
  // 超期的日子不再占她的待办 —— 她已经填不了了，一直挂着只是噪音。
  // 缺口不会消失：它变成老板后台「超期未登记」里的一条（老板 10-30 要的提示）。
  const opsRequired = opsEditable && (workedOps || backfillMode)
  const canSubmit = clockOk && (!opsRequired || prog.ok)
    && commentOk && issuesOk && (!policy.truth_declaration || truth)
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

      {/* 被退回了 —— 放在最上面，一进来就看到。
          老板 10-13：经理核对发现问题要退回重填，客服得知道哪里不对。
          退回时 submitted_at 被清空，所以「有退回记录 + 当前未提交」= 要改。 */}
      {/* 别的日子被退回了还没改 —— 一进来就看见，点进去改 */}
      {pending.filter(r => r.work_date !== date).length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4">
          <p className="font-bold text-red-900 text-sm mb-2">
            ↩ 有 {pending.filter(r => r.work_date !== date).length} 天的日报被退回了，还没改
          </p>
          {pending.filter(r => r.work_date !== date).map(r => (
            <div key={r.id} className="flex items-start gap-3 bg-white/70 rounded-xl px-3 py-2 mb-1.5 last:mb-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-900">{r.work_date}</p>
                <p className="text-sm text-red-800 leading-relaxed">{r.reason}</p>
              </div>
              <button onClick={() => setDate(r.work_date)}
                className="shrink-0 text-xs text-white font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: 'linear-gradient(135deg,#6b1414,#c0392b)' }}>
                去修改
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 管理员补录入口 —— 只有 admin 看得到。
          ⚠️ 不要给客服和经理开这个：代码里那条注释写得很清楚 ——
             「那等于开了补填口子，她可以周五把周一到周四空着的日报全补上，
               当下填写就全废了」。 */}
      {isBoss && !editingPast && (
        backfill ? (
          <div className="bg-white rounded-2xl p-4 shadow-sm border-2 border-amber-300">
            <p className="text-sm font-bold text-gray-900 mb-1">补录其他日期</p>
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
              正常补填走「退回重填」（经理在团队今日退回，本人自己改）。
              这个入口只给你，每次都会记一条操作日志 —— 谁、哪天、什么原因。
            </p>
            <div className="flex gap-2 flex-wrap items-start">
              <input type="date" max={today} value={backfill.date}
                onChange={e => setBackfill(b => ({ ...b, date: e.target.value }))}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400" />
              <input value={backfill.reason}
                onChange={e => setBackfill(b => ({ ...b, reason: e.target.value }))}
                placeholder="为什么要补（必填）—— 例：经理当天没打卡，数据电话问到的"
                className="flex-1 min-w-56 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400" />
              <button disabled={busy || !backfill.date || backfill.reason.trim().length < 2
                               || backfill.date >= today}
                onClick={async () => {
                  try {
                    await logBackfill(backfill.date, backfill.reason)
                    setBackfillReason(backfill.reason.trim())
                    setDate(backfill.date)
                    setBackfill(null)
                  } catch (e) { setErr(e.message) }
                }}
                className="text-white font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#6b1414,#c0392b)' }}>
                开始补录
              </button>
              <button onClick={() => setBackfill(null)} className="text-sm text-gray-500 px-2 py-2">取消</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setBackfill({ date: '', reason: '' })}
            className="self-start text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
            补录其他日期
          </button>
        )
      )}

      {/* 正在改历史日 —— 必须一眼看出不是在填今天，否则会填错日子 */}
      {editingPast && (
        <div className="bg-amber-100 border-2 border-amber-400 rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-bold text-amber-900">
            {backfillReason ? `正在补录 ${date} 的数据` : `正在修改 ${date} 的日报（不是今天）`}
          </span>
          {backfillReason && (
            <span className="text-xs text-amber-800 bg-white/70 rounded-lg px-2 py-1">
              补录原因：{backfillReason}
            </span>
          )}
          <span className="flex-1" />
          <button onClick={() => { setDate(today); setBackfillReason('') }}
            className="text-xs font-semibold text-amber-900 border border-amber-500 rounded-lg px-3 py-1.5 hover:bg-amber-200">
            回到今天
          </button>
        </div>
      )}

      {!submitted && myReturns.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4">
          <p className="font-bold text-amber-900 text-sm mb-1.5">
            ↩ 这份日报被退回了，改完要重新提交
          </p>
          {myReturns.map(r => (
            <div key={r.id} className="text-sm text-amber-900 bg-white/70 rounded-xl px-3 py-2 mb-1.5 last:mb-0">
              <p className="leading-relaxed">{r.reason}</p>
              <p className="text-xs text-amber-700 mt-1">
                {new Date(r.returned_at).toLocaleString('zh-CN', {
                  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                {' · '}{staffName(r.returned_by)}
              </p>
            </div>
          ))}
          <p className="text-xs text-amber-700 mt-1">
            真实性声明要重新勾一次 —— 改完的内容也要你确认。
          </p>
        </div>
      )}

      {/* 出勤只显示不操作 —— 打卡在工作台首页，那里一进来就看得到。
          老板 10-13：「我的日报只要自动同步数据就好了」 */}
      <Card title="出勤">
        <AttendanceCard compact />
      </Card>

      {/* ── 平台咨询登记 ──────────────────────── */}
      <div id="inquiry-section" className="scroll-mt-4" />
      <Card title={`平台咨询登记 · ${opsDate}（${WD[weekdayOf(opsDate)]}）`} hint="填的是【昨天】的人数 —— 平台上的咨询要到第二天才数得准，这是老板 10-30 定的。每个触点逐个检查，填你自己接待的。昨天 0 个也要登记 —— 填 0 就行，不填不算。前面几个是发内容的号；老客户回访和企业客户预订是客人来的别的路子，一样要记。归别人管的号只显示对方填了多少，你不用填。左边显示你在「今天发了什么」里登记的内容，不用重复填。鼠标移到行上，右边 ✕ 可以删掉这个号">
        <div className="space-y-1.5">
          {/* ⚠️ 2026-10-20 老板：「经理看不到小红书迁喜和盼达的登记，
              我想大家同步都可以看到」。
              【看得到】和【必须填】是两件事，之前我一刀切把两个都收了。
              现在：全部账号都列出来；归自己的能填；归别人的显示对方填了多少（只读）。
              ⚠️ 闸门（inquiryProgress）仍然只算归自己的 ——
                 否则小洁又会卡在她填不了的小红书上，交不了日报。 */}
          {myChannels(config.channelAccounts, null, true).map(a => {
            // ⚠️ 2026-10-20 老板：「小红书这两个的填写交给我和经理」。
            //    做成【经理和老板能填任何号】，而不是改归属 ——
            //    改归属会让运营那边的页面立刻变空，而这件事还没跟本人谈。
            //    系统不该替人把话说出去。
            //    注意：能填 ≠ 必须填。闸门（inquiryProgress）仍只算归自己的，
            //    所以经理不会因为小红书没填而交不了日报。
            const mine = ownsAccount(a, user?.id, isBoss) || isManager
            // 只显示自己填的 —— 两个人在岗时各填各的
            const rec = opsDay.inquiries.find(i => i.account_id === a.id && i.staff_id === user?.id)
            // 归别人管的号：显示【所有其他人】填了多少，只读。
            // ⚠️ 2026-10-22：原来只看负责人（owner_staff_id）填了没有 ——
            //    老板自己填了迁喜 6、盼达 2，小洁那边却显示「归 Annie 填 · 还没填」。
            //    那是一句假话：填过了，只是不是负责人填的。
            //    咨询登记按人存（10-12 老板定的「两个人要知道各自」），
            //    所以这里要把别人填的【都】算上，并且说清是谁填的。
            // ⚠️ 2026-10-24 老板补录时指出：「朋友圈显示着昨天小洁写的 1 什么的」
            //    原来只在【归别人管】时才算 theirs，所以老板（他看得到所有号）
            //    永远看到一个空框 —— 以为没人填，再填一遍，合计就翻倍。
            //    咨询登记是按人存的，两个人各填 1，公司总数就是 2。
            //    所以不管归谁，别人填过的都要摆在他眼前。
            const theirs = opsDay.inquiries.filter(i => i.account_id === a.id && i.staff_id !== user?.id)
            const theirSum = theirs.reduce((n, i) => n + (Number(i.count) || 0), 0)
            const theirWho = [...new Set(theirs.map(i =>
              staff?.find?.(x => x.id === i.staff_id)?.name || i.staff_id))].join('、')
            const ownerName = staff?.find?.(x => x.id === a.owner_staff_id)?.name
              || a.owner_staff_id || '公共'
            const myPosts = opsDay.posts.filter(p => p.account_id === a.id && p.posted_by === user?.id)
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
                  background: planned ? '#d1d5db'
                    : !mine ? (theirs.length ? '#86efac' : '#e5e7eb')
                    : done ? '#22c55e' : '#f59e0b' }} />
                <span className="text-xs text-gray-400 w-12 shrink-0">{a.platform}</span>
                {/* 老板 10-21：定位写在名字【下面】的小灰字里。
                    原来它单占一列，「全车型 · 老客复购 / 回访」这种长一点的
                    直接被截断，等于写了没人看得到。 */}
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm ${planned ? 'text-gray-400' : 'font-semibold'}`}>{a.name}</span>
                  {a.positioning && (
                    <span className="block text-xs text-gray-400 leading-tight">{a.positioning}</span>
                  )}
                </span>
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
                ) : !mine ? (
                  /* 归别人管的号 —— 看得到，不用填，也填不了 */
                  <span className="text-xs text-gray-400 w-44 text-right shrink-0">
                    {theirs.length
                      ? <><b className="text-gray-600">{theirSum}</b> 人 · {theirWho} 填的</>
                      : <>归 {ownerName} 填 · 还没填</>}
                  </span>
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
                        : <span className="text-gray-300">昨天没登记发布</span>}
                    </span>
                    {/* 别人已经填过的 —— 摆在输入框左边，填之前一眼看得到，
                        免得又填一遍把合计顶成两倍 */}
                    <span className="text-xs w-24 text-right shrink-0 truncate">
                      {theirs.length
                        ? <span className="text-green-700 font-semibold">{theirWho}已填 {theirSum}</span>
                        : <span className="text-gray-300">归 {ownerName}</span>}
                    </span>
                    {opsEditable ? (
                      <input type="number" min="0" step="1" placeholder="待填"
                        defaultValue={rec?.count ?? ''}
                        onBlur={e => { if (e.target.value !== '') run(() => saveInquiry(opsDate, a.id, e.target.value)) }}
                        className={`w-20 border rounded-lg px-2 py-1 text-sm font-mono text-right outline-none focus:border-red-400 shrink-0 ${
                          done ? 'border-green-200 bg-green-50' : 'border-amber-300 bg-amber-50'}`} />
                    ) : (
                      /* 过了补填期限 —— 看得到，改不了。谁能补多久见 OPS_BACKFILL_DAYS */
                      <span className="w-20 text-right text-sm font-mono shrink-0 text-gray-400">
                        {rec?.count ?? '—'}
                      </span>
                    )}
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
          <span className="text-gray-500">我昨天接待合计</span>
          <span className="font-mono font-bold text-lg">{prog.total} 人</span>
        </div>
        {!prog.ok && opsRequired && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-2">
            ⚠️ {opsDate} 还差 {prog.missing.map(a => a.name).join('、')} 没登记 ——
            {backfillMode ? '这几个号那天一个人都没登记，补上才能提交' : '填完才能提交今天的日报'}
          </p>
        )}
        {/* 能看、不能填的两种情况，都要说清为什么，不然就是一张静悄悄的死表 */}
        {!opsEditable && (
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mt-2">
            {opsDate} 已经过了你的补填期限，这一天只能看不能改。
            {user?.role === 'cs' && '客服只填前一天；'}
            {user?.role === 'manager' && '经理最多补到前天；'}
            漏掉的日子会出现在老板后台的「超期未登记」里。
          </p>
        )}
        {opsEditable && !opsRequired && !prog.ok && (
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mt-2">
            你{opsDate}没打卡（不在岗），这一天的登记不卡你的日报 —— 想补也可以直接填。
          </p>
        )}
      </Card>

      {/* ── 超期未登记（只有老板看得到）───────────
          老板 10-30 要的那条提示。客服／经理那边已经过了补填期限，
          待办上不再催她们 —— 但账不能就这么平了，它出现在这里。
          点一下直接跳到那天的补录。 */}
      {isBoss && overdue.length > 0 && (
        <Card title={`超期未登记 · ${overdue.length} 天`}
          hint="这些日子已经过了客服和经理的补填期限，她们填不了了。只有你能补。空着也行，但周月汇总里这几天的转化率就是假的">
          <div className="space-y-1.5">
            {overdue.slice(0, 10).map(o => (
              <div key={o.date} className="flex items-center gap-2.5 flex-wrap bg-amber-50 rounded-xl px-3 py-2">
                <span className="text-sm font-mono font-semibold text-amber-900">{o.date}</span>
                <span className="text-xs text-gray-500">（{WD[weekdayOf(o.date)]}）</span>
                <span className="text-xs text-gray-600 flex-1 min-w-0">
                  缺 {o.missing.map(a => a.name).join('、')}
                </span>
                <button className="text-xs font-semibold text-red-700 underline shrink-0"
                  onClick={() => setBackfill({ date: addDays(o.date, 1), reason: `补 ${o.date} 的运营数据` })}>
                  我来补
                </button>
              </div>
            ))}
            {overdue.length > 10 && (
              <p className="text-xs text-gray-400 pt-1">还有 {overdue.length - 10} 天没列出来</p>
            )}
          </div>
        </Card>
      )}

      {/* ── 昨天接待多少、下单几个 ───────────────
           老板 10-12：「我们需要了解的主要东西是今天客服一共接待了多少人，
           下单几个」—— 这是整页最重要的一行，不该拆在两张卡片里。 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h2 className="font-bold text-gray-900 text-sm mb-3">
          昨天接待了多少 · 下了几单
          <span className="ml-2 text-xs font-normal text-gray-400">{opsDate}（{WD[weekdayOf(opsDate)]}）</span>
        </h2>
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
            sub={prog.total > 0 && adds != null ? `平台来的留下 ${Math.round(adds / prog.total * 100)}%` : '昨天微信新增好友'}
            onClick={() => document.getElementById('wechat-adds')?.focus()} />
          <Arrow />
          {/* ⚠️ 这里取 opsPerf 不是 perf —— 三段必须同一天。
              分母是昨天的咨询，分子拿今天的单，算出来的转化率是假的。 */}
          <Big label="下单" value={opsPerf.booked} unit="单" tag="自动"
            sub={adds > 0 ? `加微信的成了 ${Math.round(opsPerf.booked / adds * 100)}%` : '昨天你建的单'} />
        </div>

        {/* 实际接待 —— 一个数，不分平台 */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
          <span className="text-sm text-gray-600 shrink-0">昨天微信加了几个人</span>
          <input id="wechat-adds" type="number" min="0" step="1" placeholder="待填"
            key={`adds-${opsDate}-${opsMine?.wechat_adds ?? ''}`}
            defaultValue={opsMine?.wechat_adds ?? ''}
            disabled={!opsEditable}
            onBlur={e => { if (e.target.value !== '') run(() => upsertWorkLog(opsDate, { wechat_adds: Number(e.target.value) })) }}
            className={`w-24 border rounded-lg px-2 py-1 text-sm font-mono text-right outline-none focus:border-red-400 shrink-0 ${
              adds != null ? 'border-green-200 bg-green-50' : 'border-amber-300 bg-amber-50'}`} />
          <span className="text-xs text-gray-400 flex-1 min-w-0">
            这是<b>实际接待</b> —— 昨天真的加上「迁喜生活服务」的人。
            平台上问了但没加的不算，那部分流失正是要看的
          </span>
        </div>
        {/* 就地填 —— 不用滚到下面的登记表 */}
        {quickFill && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
            {prog.need.map(a => {
              const rec = opsDay.inquiries.find(i => i.account_id === a.id && i.staff_id === user?.id)
              return (
                <div key={a.id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-10 shrink-0">{a.platform}</span>
                  <span className="text-sm font-semibold w-20 shrink-0">{a.name}</span>
                  <span className="text-xs text-gray-400 flex-1 truncate min-w-0">{a.positioning}</span>
                  <input type="number" min="0" step="1" placeholder="待填"
                    defaultValue={rec?.count ?? ''}
                    disabled={!opsEditable}
                    onBlur={e => { if (e.target.value !== '') run(() => saveInquiry(opsDate, a.id, e.target.value)) }}
                    className={`w-20 border rounded-lg px-2 py-1 text-sm font-mono text-right outline-none focus:border-red-400 shrink-0 ${
                      rec ? 'border-green-200 bg-green-50' : 'border-amber-300 bg-amber-50'}`} />
                </div>
              )
            })}
            <p className="text-xs text-gray-400 pt-1">
              填的是 <b>{opsDate}</b> 的数。昨天 0 个也要填 0 —— 空着不算登记。未开通的号在下面的登记表里，这里不显示
            </p>
          </div>
        )}

        {/* 老板 10-15：「和钱有关的记录客服没太大必要看」
            去掉金额、留下单数。真正的理由不是保密（她在收款记录里全看得到），
            而是【按金额衡量客服会诱导她推销】——
            同样接一单，面包车和大卡车金额差三倍，但她的工作量差不多。
            表上天天挂着金额，她自然会往贵的车型引，而客人只需要小车。
            这对复购是直接伤害。单数才是她真实的产出。 */}
        <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-gray-100">
          <Stat label="今天搬的（我接的）" value={`${perf.served} 单`} />
          <Stat label="今天你建的单" value={`${perf.booked} 单`} />
          {isManager && <Stat label="完成金额" value={money(perf.servedAmount)} />}
        </div>
        <p className="text-xs text-gray-400 mt-2 leading-relaxed">
          <b>两个数要你填</b>：平台咨询（分平台登记）和加微信人数，
          填的都是 <b>昨天（{opsDate}）</b> 的 ——
          平台上的咨询要第二天才数得准，当天填只能靠猜。<br />
          「下单」和「今天搬的」都是系统按你的账号自动算的，不用管。
          多数单几天后才搬，所以「今天搬的」和「今天下单的」不是同一批。
        </p>
      </div>

      {/* ── 发布内容 ─────────────────────────── */}
      {/* 老板 10-15：「经理应该是早上先核对账目吧，这个应该加到经理的日报里」
          这是她每天第一件事，放在最上面。T+1 —— 核的是昨天的。 */}
      {isManager && (
        <Card title="昨天的账核完了吗"
          hint={openD.length === 0 ? '前 7 天都核完了' : `还有 ${openD.length} 天没闭环 —— 这是你每天第一件事`}>
          {openD.length === 0 ? (
            <p className="text-sm text-green-700 flex items-center gap-1.5 py-1">
              <Check size={14} /> 前 7 天的账和客服日报都核完确认了
            </p>
          ) : (
            <div className="space-y-1.5">
              {openD.map(o => (
                <div key={o.work_date} className="flex items-center gap-2.5 flex-wrap bg-amber-50 rounded-xl px-3 py-2">
                  <span className="font-semibold text-sm shrink-0">
                    {o.work_date}{o.work_date === addDays(date, -1) ? '（昨天）' : ''}
                  </span>
                  <span className="text-xs flex-1 min-w-0">
                    {!o.team_confirmed && <span className="text-red-700 font-semibold mr-2">客服日报未审核</span>}
                    {!o.day_closed && <span className="text-red-700 font-semibold mr-2">账未日结</span>}
                    <span className="text-gray-400">{o.submitted_cnt}/{o.worked_cnt} 人交了日报</span>
                  </span>
                  {!o.team_confirmed && (
                    <button onClick={() => navigate(`/admin/team-today?date=${o.work_date}`)}
                      className="text-xs text-white font-semibold px-2.5 py-1 rounded-lg shrink-0"
                      style={{ background: 'linear-gradient(135deg,#6b1414,#c0392b)' }}>去审核</button>
                  )}
                  {!o.day_closed && (
                    <button onClick={() => navigate(`/admin/reconcile?date=${o.work_date}`)}
                      className="text-xs font-semibold text-red-700 border border-red-300 rounded-lg px-2.5 py-1 shrink-0 hover:bg-red-100">去对账</button>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2.5 pt-2.5 border-t border-dashed border-gray-200 leading-relaxed">
            核的是<b className="text-gray-600">昨天</b>的 —— 小洁 20:00 才交日报，你 20:15 看必然草草了事；
            师傅当天没发的数据，第二天上午打个电话就能要到。
          </p>
        </Card>
      )}

      {/* 老板 10-15：「我觉得她应该是我今天编辑了什么」
          分工定下来之后这里一直没跟着改 —— Annie设计、小洁发布，
          给经理看「今天发了什么」是记错了人的活。 */}
      {isManager && (() => {
        const edits = myEditsToday(content.items, content.slots, user?.id, date, sydneyDateOf)
        const out = weekOutput(content.slots, content.items)
        return (
          <Card title="今天编辑了什么"
            hint={`本周原创产出 文案 ${out.text.done}/${out.text.total} · 视频 ${out.video.done}/${out.video.total} 就绪`}>
            <div className="space-y-1.5">
              {edits.map(it => (
                <div key={it.id} className="flex items-start gap-2 py-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                    it.ready ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {it.ready ? '就绪' : '草稿'}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0 w-7">{it.isNew ? '新建' : '修改'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{it.title || '（还没写标题）'}</p>
                    {it.slots.length > 0 && (
                      <p className="text-xs text-gray-400 truncate">
                        {it.slots.map(sl => `${sl.slot_date.slice(5)} ${nameOfAccount(sl.account_id)}`).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {edits.length === 0 && (
                <p className="text-sm text-gray-400 py-1">
                  今天还没编辑内容 —— 去<button onClick={() => navigate('/admin/content')}
                    className="text-red-700 font-semibold underline mx-0.5">内容排期</button>看本周排了什么
                </p>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2.5 pt-2.5 border-t border-dashed border-gray-200 leading-relaxed">
              只数原创 —— 朋友圈 7 条全是复用，算进去会让产出看起来比实际多一倍。
            </p>
          </Card>
        )
      })()}

      {/* 老板 10-15：「有了内容排期和今天要发，日报里今天发了什么还要留下吗，
            标题是不是可以自动填写上去」—— 他说对了。
          原来这里能手填，而 mark_slot_posted 也写 content_post，
          同一条会被记两遍，统计直接翻倍。这正是做排期时想避免的双重录入。
          改成：主体只读，从排期自动来；补登记留着但弱化 ——
          排期外的发布真的会发生（师傅拍了张好照片随手发朋友圈），堵死了她就不发了。 */}
      <Card title={isManager ? '今天发了什么' : '今天发了什么（顶班时才有）'}
        hint={video.ok ? `本周视频 ${video.video} 条 · 图文 ${video.image} 条 · 从「今天要发」自动来的`
          : '⚠️ 本周还没出视频 —— 每周至少 1 条'}>
        <div className="space-y-1">
          {day.posts.map(p => {
            const a = (config.channelAccounts || []).find(x => x.id === p.account_id)
            return (
              <div key={p.id} className="flex items-center gap-2 text-sm py-1">
                <Check size={13} className="text-green-600 shrink-0" />
                <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                  p.kind === 'video' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                  {p.kind === 'video' ? '视频' : '图文'}
                </span>
                <span className="font-semibold text-xs w-16 shrink-0">{a?.name || p.account_id}</span>
                <span className="text-gray-600 flex-1 truncate">{p.title || '（没写标题）'}</span>
                <span className="text-xs text-gray-300 shrink-0">{hhmm(p.created_at)}</span>
              </div>
            )
          })}
          {day.posts.length === 0 && (
            <p className="text-sm text-gray-400 py-1">
              今天还没发内容 —— 去<button onClick={() => navigate('/admin/content-today')}
                className="text-red-700 font-semibold underline mx-0.5">今天要发</button>看排了几条
            </p>
          )}
        </div>

        {/* 补登记：排期外临时发的。弱化成一行，不是主路径 */}
        {extraAdd ? (
          <div className="mt-2.5 pt-2.5 border-t border-dashed border-gray-200">
            <p className="text-xs text-gray-400 mb-1.5">补登记排期外临时发的内容</p>
            <PostAdder accounts={requiredAccounts(config.channelAccounts, user?.id, isBoss)} disabled={busy}
              onAdd={async v => { await run(() => addPost(date, v)); setExtraAdd(false) }} />
            <button onClick={() => setExtraAdd(false)} className="text-xs text-gray-400 mt-1.5">取消</button>
          </div>
        ) : (
          <button onClick={() => setExtraAdd(true)}
            className="text-xs text-gray-400 hover:text-gray-600 mt-2.5 pt-2.5 border-t border-dashed border-gray-200 w-full text-left">
            ＋ 补登记排期外发的（比如随手发的朋友圈）
          </button>
        )}
      </Card>

      {/* ── 手填三项 ─────────────────────────── */}
      {/* 老板 10-13 把要求说具体了，而且两个角色是两种工作：
            客服  小红书搜关键词留评论，每天至少 3 条，截图为证 —— 日配额、可核验
            经理  to B 企业开发，联系了哪家、什么形式、到哪一步 —— 长线，按天算没意义
          所以不是一个字段，是分开两块。 */}
      {isManager && (
        <Card title="企业开发（to B）" hint="长线工作，不按天算数量。联系了哪家、什么形式、到哪一步">
          <textarea rows={3} defaultValue={mine?.b2b_outreach || ''}
            placeholder={'例如：\n· 给 2 家中介发了合作方案，Hurstville 那家约了周四见面\n· staging 的 ruby 介绍了一家同行，加了微信还没聊'}
            onBlur={e => run(() => upsertWorkLog(date, { b2b_outreach: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400 resize-none leading-relaxed" />
        </Card>
      )}

      {(!isManager || isBoss) && (
        <Card title="小红书评论引流"
          hint={isBoss ? `客服每天要求 ${quota} 条。你是老板，这张卡不卡你的提交`
            : commentOk ? `今天 ${commentCount} 条，达标（目标 ${quota} 条）`
            : `⚠️ 今天 ${commentCount} 条，还差 ${quota - commentCount} 条才能提交日报`}>
          {policy.comment_hint && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2 mb-2.5 whitespace-pre-line leading-relaxed">
              {policy.comment_hint}
            </p>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-gray-600 shrink-0">今天留了几条评论</span>
            <input type="number" min="0" step="1" placeholder="0"
              defaultValue={mine?.comment_count ?? ''}
              onBlur={e => { if (e.target.value !== '') run(() => upsertWorkLog(date, { comment_count: Number(e.target.value) })) }}
              className={`w-20 border rounded-lg px-2 py-1 text-sm font-mono text-right outline-none focus:border-red-400 shrink-0 ${
                isBoss ? 'border-gray-200'
                  : commentOk ? 'border-green-200 bg-green-50' : 'border-amber-300 bg-amber-50'}`} />
            <input defaultValue={mine?.comment_keywords || ''} placeholder="搜的关键词，如 搬家、长途、留学生搬家"
              onBlur={e => run(() => upsertWorkLog(date, { comment_keywords: e.target.value }))}
              className="flex-1 min-w-40 border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-red-400" />
          </div>
          <ShotUploader shots={mine?.comment_shots || []} busy={busy}
            onChange={next => run(() => upsertWorkLog(date, { comment_shots: next }))} />
        </Card>
      )}

      <Card title="今天的问题 · 想改进的地方"
        hint={isBoss ? '客服和经理每天至少写一条。你是老板，这栏不卡你的提交'
          : issuesOk ? '今天已写，达标' : '⚠️ 每天至少一条，写完才能提交日报'}>
        <div className="bg-blue-50 rounded-xl px-3 py-2.5 mb-2.5">
          <p className="text-sm text-blue-900 font-medium">🔒 这一栏只有老板能看到</p>
          <p className="text-xs text-blue-700 mt-1 leading-relaxed">
            客服经理和其他同事都看不到你写的内容。<br />
            <b>每天至少写一条，内容不限</b> —— 公司上的、操作上的、流程上的都行，
            今天没遇到问题就写你觉得该改进的地方。<br />
            公司会把大家提的整理出来，<b>在每周例会上提出讨论，好的方案会一起探讨落地</b>。
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
              {!clockOk ? '先打上班卡'
                : (opsRequired && !prog.ok) ? `提交今日记录 · 昨天还差 ${prog.missing.length} 个平台`
                : !commentOk ? `小红书评论还差 ${quota - commentCount} 条`
                : !issuesOk ? '还没写今天的问题 · 想改进的地方'
                : !truth && policy.truth_declaration ? '请先勾选上面的确认'
                : '提交今日记录'}
            </button>
            {opsRequired && !prog.ok && (
              <p className="text-xs text-gray-400 text-center mt-2">
                昨天（{opsDate}）那几个触点逐个登记完才能提交 —— 0 个咨询也要填 0
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ShotUploader({ shots, onChange, busy }) {
  const [up, setUp] = useState(false)
  async function pick(e) {
    const files = [...(e.target.files || [])]
    if (!files.length) return
    setUp(true)
    try {
      const added = []
      for (const f of files) added.push(await uploadImage(f, 'deposit-screenshots'))
      onChange([...(shots || []), ...added])
    } finally { setUp(false); e.target.value = '' }
  }
  return (
    <div className="mt-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <label className={`px-3 py-1.5 rounded-lg border border-dashed text-sm cursor-pointer shrink-0 ${
          shots?.length ? 'border-gray-200 text-gray-500' : 'border-amber-300 text-amber-700 bg-amber-50'}`}>
          {up ? '上传中…' : shots?.length ? '+ 再加截图' : '+ 评论截图'}
          <input type="file" accept="image/*" multiple className="hidden" onChange={pick} disabled={busy || up} />
        </label>
        {(shots || []).map((s, i) => (
          <span key={i} className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1 text-xs shrink-0">
            <a href={s.url || s.data} target="_blank" rel="noreferrer"
              className="text-gray-600 hover:text-red-600 max-w-24 truncate">{s.name || `截图 ${i + 1}`}</a>
            <button onClick={() => onChange(shots.filter((_, x) => x !== i))} disabled={busy}
              className="text-gray-300 hover:text-red-600">✕</button>
          </span>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-1.5">
        数字能编，截图不好编 —— Annie 和老板会点开看。一次可以选多张
      </p>
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

