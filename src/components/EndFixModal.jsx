// 补填「实际收工时间」—— 2026-10-11
//
// 两种场景共用这一个弹窗：
//   ① 开工闸门：要开新单，但上一单还挂着 → 先把上一单结掉
//   ② 迟到的结束：这一单计时超过 14 小时才点结束 → 不能直接写「现在」
//
// 设计底线：必须能自己解开，不能叫师傅去找客服。
// 师傅人在工地上，一旦需要等客服回微信，这个设计就会变成事故。
// 所以：选原因（一下）+ 确认时间（默认已填好）+ 确定 —— 三下结束。

import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { VEHICLES } from '../data/vehicles'
import {
  END_FIX_REASONS, defaultFixEnd, toLocalInput, validateFixEnd, hoursSinceStart,
} from '../utils/staleWork'

export default function EndFixModal({ order, mode, onConfirm, onClose }) {
  const v = VEHICLES[order?.vehicle]
  const minHours = v?.minHours || 1
  const [endLocal, setEndLocal] = useState(() => toLocalInput(defaultFixEnd(order, minHours)))
  const [reason, setReason] = useState('forgot')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const late = hoursSinceStart(order)
  const startLocal = new Date(order.workStartedAt)
  const startStr = startLocal.toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  })

  // 快捷：开工 + N 小时。师傅在手机上拨 datetime-local 很痛苦，给几个常用的
  const quick = [minHours, 2, 3, 4, 6].filter((h, i, a) => a.indexOf(h) === i)

  async function submit() {
    const bad = validateFixEnd(order, endLocal)
    if (bad) { setErr(bad); return }
    if (reason === 'other' && !note.trim()) { setErr('选了「其他」请简单写一下原因'); return }
    setBusy(true); setErr('')
    try {
      await onConfirm({ endedAt: new Date(endLocal).toISOString(), reason, note: note.trim() })
    } catch (e) {
      setErr(e.message || '提交失败，请重试'); setBusy(false)
    }
  }

  const hrs = (() => {
    const d = (new Date(endLocal) - startLocal) / 3600000
    return Number.isFinite(d) && d > 0 ? d : 0
  })()

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl max-h-[92vh] overflow-y-auto">

        <div className="px-5 pt-5 pb-3 flex items-start gap-3 border-b border-gray-100">
          <AlertTriangle size={24} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-lg leading-snug">
              {mode === 'gate' ? '上一单还没结束' : '这单计时太久了'}
            </h3>
            <p className="text-gray-500 text-sm mt-0.5">
              {mode === 'gate'
                ? '先把它结掉才能开始新的一单'
                : '实际几点收的工？填对了账单才算得对'}
            </p>
          </div>
          {mode !== 'gate' && (
            <button onClick={onClose} className="p-1 -mr-1 text-gray-400"><X size={20} /></button>
          )}
        </div>

        <div className="px-5 py-4 space-y-4">

          <div className="bg-amber-50 rounded-xl px-4 py-3">
            <p className="font-semibold text-amber-900">
              {order.orderNo || order.id} · {order.customerName}
            </p>
            <p className="text-amber-700 text-sm mt-1">
              {order.vehicle} · 开工 {startStr}
            </p>
            <p className="text-amber-600 text-sm mt-0.5">
              到现在已经 <strong>{late >= 24 ? `${(late / 24).toFixed(1)} 天` : `${late.toFixed(1)} 小时`}</strong>
            </p>
          </div>

          <div>
            <p className="text-gray-700 font-semibold text-sm mb-2">实际几点收工？</p>
            <input
              type="datetime-local"
              value={endLocal}
              onChange={e => { setEndLocal(e.target.value); setErr('') }}
              className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-base focus:border-red-400 outline-none"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {quick.map(h => (
                <button key={h}
                  onClick={() => { setEndLocal(toLocalInput(defaultFixEnd(order, h))); setErr('') }}
                  className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium active:bg-gray-200"
                >干了 {h} 小时</button>
              ))}
            </div>
            {hrs > 0 && (
              <p className="text-gray-500 text-sm mt-2">
                按这个时间算 = <strong className="text-gray-800">{hrs.toFixed(1)} 小时</strong>
                {hrs < minHours && <span className="text-amber-600 ml-1">（不足起步 {minHours} 小时，按起步算）</span>}
              </p>
            )}
          </div>

          <div>
            <p className="text-gray-700 font-semibold text-sm mb-2">为什么没能及时点结束？</p>
            <div className="grid grid-cols-2 gap-2">
              {END_FIX_REASONS.map(r => (
                <button key={r.key}
                  onClick={() => { setReason(r.key); setErr('') }}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition ${
                    reason === r.key
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >{r.label}</button>
              ))}
            </div>
            {reason === 'other' && (
              <input
                value={note} onChange={e => { setNote(e.target.value); setErr('') }}
                placeholder="简单写一下"
                className="w-full mt-2 border-2 border-gray-200 rounded-xl px-3 py-2.5 text-base focus:border-red-400 outline-none"
              />
            )}
          </div>

          {err && <p className="text-red-600 text-sm font-medium">{err}</p>}
        </div>

        <div className="px-5 pb-5 pt-1">
          <button
            onClick={submit} disabled={busy}
            className="w-full bg-gradient-to-r from-red-800 to-red-600 text-white font-bold py-3.5 rounded-xl disabled:opacity-50"
          >
            {busy ? '提交中…' : mode === 'gate' ? '结束上一单，开始新的' : '确认收工时间'}
          </button>
          <p className="text-gray-400 text-xs text-center mt-2.5">
            客服能看到这是补填的时间，有问题会找你核对
          </p>
        </div>
      </div>
    </div>
  )
}
