// 今天的进度 —— 工作台首页，打卡下面
//
// 老板 10-12 提的需求，10-15 定在这个位置：打卡完了，接下来就是「那我今天要干嘛」。
// 她「漫无目的」抬头看屏幕的那一刻，这块就在眼前 —— 所以是常驻面板，不是弹窗。

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { sydneyToday, addDays, sydneyDateOf } from '../utils/date'
import { requiredAccounts, inquiryProgress, weeklyVideo, weekRange } from '../utils/worklog'
import { todayToPost, weekOutput, myEditsToday } from '../utils/content'
import { todayTasks, weekTasks, progressOf, S } from '../utils/tasks'
import { Check, ChevronRight, Clock } from 'lucide-react'

export default function DailyProgress() {
  const { user, config, getWorkday, getContentRange, openDays, getPolicyText, getRoster } = useApp()
  const navigate = useNavigate()
  const date = sydneyToday()
  const isManager = user?.role === 'admin' || user?.role === 'manager'

  const [day, setDay] = useState({ logs: [], inquiries: [], posts: [] })
  const [content, setContent] = useState({ slots: [], items: [] })
  const [open, setOpen] = useState([])
  const [policy, setPolicy] = useState({})
  const [roster, setRoster] = useState([])   // 排班表是「谁今天在岗」的唯一真相

  const wk = useMemo(() => weekRange(date), [date])
  useEffect(() => {
    let alive = true
    ;(async () => {
      const [d, c, p, rs] = await Promise.all([
        getWorkday(date), getContentRange(wk.from, wk.to), getPolicyText(), getRoster(date, date)])
      if (!alive) return
      setDay(d); setContent(c); setPolicy(p); setRoster(rs.roster || [])
      if (isManager) openDays(addDays(date, -7), addDays(date, -1)).then(o => alive && setOpen(o))
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, isManager])

  const log = day.logs.find(l => l.staff_id === user?.id)
  const accounts = requiredAccounts(config.channelAccounts)
  const prog = inquiryProgress(accounts, day.inquiries, date, user?.id)
  const slotsToday = todayToPost(content.slots, content.items, date)
  const edits = isManager
    ? myEditsToday(content.items, content.slots, user?.id, date, sydneyDateOf).length : 0

  const tasks = todayTasks({
    role: user?.role, log, inquiryOk: prog.ok, inquiryMissing: prog.missing,
    slotsToday, quota: Number(policy.comment_quota) || 3,
    openDays: open, editedToday: edits,
    nameOfAccount: id => (config.channelAccounts || []).find(a => a.id === id)?.name || id,
  })
  const week = weekTasks({
    role: user?.role,
    weekVideo: weeklyVideo(day.posts, date),
    weekOut: isManager ? weekOutput(content.slots, content.items) : null,
  })
  const p = progressOf(tasks)

  // ⚠️ 2026-10-16 改：原来写的是「没打卡之前不显示」，理由是「摆一堆未完成只是噪音」。
  //    老板上线后指出看不到引导 —— 那个判断是错的：
  //    【这块面板本身就是引导】，打卡前藏起来等于「要引导的时候没有，
  //     不需要的时候才出现」。而且第一件事就是打卡，它本该是清单第一条。
  //
  //    现在：今天不该上班的人才不显示（她休息，摆一堆任务才是噪音）。
  //    ⚠️ 2026-10-16 二次修正：第一版写的是「排班表里是 A/B 才显示」，
  //       结果把老板自己挡在外面了 —— roster_rule 里只有小洁和 Annie，
  //       没有 phill，所以一旦那天有排班数据，他就被判成「不该上班」。
  //
  //       正确的判断是反过来：【只有排班表明确写着今天休息才隐藏】。
  //       压根不在排班表里的人（老板、以后新加的人）不等于不上班。
  const myShift = roster.find(r => r.staff_id === user?.id)?.shift
  const offToday = myShift === 'off' || myShift === 'leave' || myShift === 'holiday'
  if (offToday) return null

  const todo = tasks.filter(t => t.state === S.todo)
  const rest = tasks.filter(t => t.state !== S.todo)

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* 头部：进度 + 剩余时间。老板 10-15 说原来「有点画质和一般的感觉」，
          重做了视觉层次 —— 数字放大、圆环指示器、行有底色和 hover。 */}
      <div className="px-4 pt-3.5 pb-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-gray-800 text-sm">今天的进度</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {p.allDone ? '今天安排的都做完了' : `还有 ${todo.length} 件事`}
            </p>
          </div>
          <div className="text-right">
            <p className="font-bold text-gray-900 leading-none">
              <span className="text-2xl">{p.done}</span>
              <span className="text-sm text-gray-400"> / {p.total}</span>
            </p>
            {!p.allDone && p.minutesLeft > 0 && (
              <p className="text-xs text-gray-400 mt-1">大约还要 <b className="text-gray-600">{p.minutesLeft}</b> 分钟</p>
            )}
          </div>
        </div>

        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-2.5">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${p.total ? Math.max(4, p.done / p.total * 100) : 0}%`,
                     background: p.allDone
                       ? 'linear-gradient(90deg,#1e9e5a,#22c55e)'
                       : 'linear-gradient(90deg,#6b1414,#c0392b)' }} />
        </div>
      </div>

      {p.allDone ? (
        <div className="px-4 pb-4">
          <div className="bg-green-50 rounded-xl px-3.5 py-3 flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shrink-0">
              <Check size={15} className="text-white" />
            </span>
            <p className="text-sm text-green-800 font-medium">今天安排的事都做完了，辛苦了 👏</p>
          </div>
        </div>
      ) : (
        <div className="px-2 pb-1.5">
          {/* 没做的排前面 —— 她打开就该看见要干什么，不是先看自己做过什么 */}
          {todo.map(t => (
            <Row key={t.key} t={t} onGo={() => t.to && navigate(t.to)} />
          ))}
        </div>
      )}

      {/* 已完成 / 等待 / 选填 收在下面，压暗 */}
      {!p.allDone && rest.length > 0 && (
        <div className="px-2 pb-1.5">
          {rest.map(t => <Row key={t.key} t={t} dim />)}
        </div>
      )}

      {week.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap px-4 py-2.5 bg-gray-50 border-t border-gray-100">
          <span className="text-xs text-gray-400 shrink-0">本周</span>
          {week.map(w => (
            <span key={w.key}
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                w.ok ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {w.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Row({ t, onGo, dim }) {
  const clickable = !!onGo && t.state === S.todo
  return (
    <button onClick={onGo} disabled={!clickable}
      className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-left transition-colors ${
        clickable ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'}`}>
      <Dot state={t.state} />
      <span className="flex-1 min-w-0">
        <span className={`block text-sm leading-tight ${
          t.state === S.done ? 'text-gray-400'
          : t.state === S.wait || t.state === S.skip ? 'text-gray-400'
          : 'text-gray-800 font-medium'}`}>{t.label}</span>
        {t.hint && t.state !== S.done && (
          <span className="block text-xs text-gray-400 mt-0.5 leading-snug truncate">{t.hint}</span>
        )}
      </span>
      {t.state === S.todo && t.minutes > 0 && (
        <span className="shrink-0 text-xs text-gray-400 bg-gray-50 rounded-full px-2 py-0.5">
          {t.minutes} 分
        </span>
      )}
      {clickable && <ChevronRight size={14} className="shrink-0 text-gray-300" />}
    </button>
  )
}

function Dot({ state }) {
  if (state === S.done) return (
    <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
      <Check size={12} className="text-white" strokeWidth={3} />
    </span>
  )
  if (state === S.wait) return (
    <span className="w-5 h-5 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
      <Clock size={11} className="text-amber-500" />
    </span>
  )
  if (state === S.skip) return (
    <span className="w-5 h-5 rounded-full border border-dashed border-gray-200 shrink-0" />
  )
  return (
    <span className="w-5 h-5 rounded-full border-2 shrink-0" style={{ borderColor: '#c0392b' }} />
  )
}
