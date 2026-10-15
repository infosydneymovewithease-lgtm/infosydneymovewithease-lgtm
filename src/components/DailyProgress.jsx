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
import { Check, ChevronRight } from 'lucide-react'

export default function DailyProgress() {
  const { user, config, getWorkday, getContentRange, openDays, getPolicyText } = useApp()
  const navigate = useNavigate()
  const date = sydneyToday()
  const isManager = user?.role === 'admin' || user?.role === 'manager'

  const [day, setDay] = useState({ logs: [], inquiries: [], posts: [] })
  const [content, setContent] = useState({ slots: [], items: [] })
  const [open, setOpen] = useState([])
  const [policy, setPolicy] = useState({})

  const wk = useMemo(() => weekRange(date), [date])
  useEffect(() => {
    let alive = true
    ;(async () => {
      const [d, c, p] = await Promise.all([
        getWorkday(date), getContentRange(wk.from, wk.to), getPolicyText()])
      if (!alive) return
      setDay(d); setContent(c); setPolicy(p)
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
  })
  const week = weekTasks({
    role: user?.role,
    weekVideo: weeklyVideo(day.posts, date),
    weekOut: isManager ? weekOutput(content.slots, content.items) : null,
  })
  const p = progressOf(tasks)

  // 没打卡之前不显示 —— 那时候她还没开始上班，摆一堆未完成只是噪音
  if (!log?.clock_in) return null

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-baseline justify-between gap-2 mb-2.5 flex-wrap">
        <h2 className="font-semibold text-gray-800 text-sm">今天的进度</h2>
        <span className="text-xs text-gray-400">
          {p.allDone
            ? <span className="text-green-700 font-semibold">今天的都做完了 👏</span>
            : <>已完成 {p.done}/{p.total}
                {p.minutesLeft > 0 && <> · 剩下的大约 <b className="text-gray-600">{p.minutesLeft} 分钟</b></>}
              </>}
        </span>
      </div>

      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
        <div className="h-full rounded-full transition-all"
          style={{ width: `${p.total ? p.done / p.total * 100 : 0}%`,
                   background: p.allDone ? '#22c55e' : 'linear-gradient(90deg,#6b1414,#c0392b)' }} />
      </div>

      <div className="grid sm:grid-cols-2 gap-x-5 gap-y-0.5">
        {tasks.map(t => (
          <button key={t.key} onClick={() => t.to && navigate(t.to)}
            disabled={!t.to || t.state === S.done}
            className={`flex items-start gap-2 py-1 text-left rounded ${
              t.to && t.state !== S.done ? 'hover:bg-gray-50' : ''}`}>
            <span className="shrink-0 w-4 pt-0.5 text-center text-xs">
              {t.state === S.done ? <Check size={13} className="text-green-600 inline" />
               : t.state === S.wait ? <span className="text-gray-300">⏳</span>
               : t.state === S.skip ? <span className="text-gray-300">—</span>
               : <span className="inline-block w-2.5 h-2.5 border border-gray-300 rounded-sm" />}
            </span>
            <span className="flex-1 min-w-0">
              <span className={`text-sm ${
                t.state === S.done ? 'text-gray-400 line-through'
                : t.state === S.wait || t.state === S.skip ? 'text-gray-400' : 'text-gray-800'}`}>
                {t.label}
              </span>
              {t.hint && t.state !== S.done && (
                <span className="block text-xs text-gray-400 leading-snug">{t.hint}</span>
              )}
            </span>
            {t.state === S.todo && t.minutes > 0 && (
              <span className="shrink-0 text-xs text-gray-300 pt-0.5">约 {t.minutes} 分</span>
            )}
            {t.to && t.state === S.todo && (
              <ChevronRight size={13} className="shrink-0 text-gray-300 mt-1" />
            )}
          </button>
        ))}
      </div>

      {week.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap mt-2.5 pt-2.5 border-t border-dashed border-gray-200">
          <span className="text-xs text-gray-400">本周</span>
          {week.map(w => (
            <span key={w.key} className={`text-xs font-semibold ${w.ok ? 'text-green-700' : 'text-amber-700'}`}>
              {w.ok ? '✓ ' : '⚠️ '}{w.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
