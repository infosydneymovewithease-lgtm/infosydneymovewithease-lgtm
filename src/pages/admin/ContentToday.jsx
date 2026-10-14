// 今天要发的 —— 客服（小洁）视角，2026-10-14
//
// 老板：「到了客服这里就是今天要发布的那些内容就直接复制发布」
//
// 设计上只有一条铁律：**只显示「待发」的**。
// 草稿、素材没传完的一律不出现 —— 她打开就是能直接发的，
// 不用判断哪条好了哪条没好。判断是经理的事，不该外溢到发布的人身上。

import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { sydneyToday } from '../../utils/date'
import { todayToPost, bodyFor, SOURCE_LABEL } from '../../utils/content'
import { Check, Copy, Download } from 'lucide-react'

const hhmm = iso => iso
  ? new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  : ''

export default function ContentToday() {
  const { config, getContentRange, markSlotPosted } = useApp()
  const date = sydneyToday()
  const [data, setData] = useState({ slots: [], items: [] })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState('')

  const refresh = useCallback(async () => setData(await getContentRange(date, date)), [getContentRange, date])
  useEffect(() => { refresh() /* eslint-disable-next-line */ }, [date])

  const list = todayToPost(data.slots, data.items, date)
  const posted = list.filter(s => s.posted_at).length
  const nameOf = id => (config.channelAccounts || []).find(a => a.id === id)?.name || id

  async function copy(text, key) {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1500) }
    catch { setErr('复制失败，手动选中复制吧') }
  }

  async function markPosted(id) {
    setBusy(true); setErr('')
    try { await markSlotPosted(id); await refresh() }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="p-5 max-w-3xl mx-auto space-y-3">
      <div>
        <h1 className="text-xl font-bold text-gray-900">今天要发的</h1>
        <p className="text-sm text-gray-400 mt-0.5">{date} · 从排期里自动来的，发完点一下就行</p>
      </div>

      {err && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[90%]
                        bg-red-600 text-white rounded-xl px-4 py-3 shadow-lg flex items-start gap-2">
          <span className="shrink-0">⚠️</span>
          <span className="text-sm flex-1 leading-relaxed">{err}</span>
          <button onClick={() => setErr('')} className="shrink-0 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {list.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-baseline mb-2">
            <span className="font-bold text-sm">今天 {list.length} 条</span>
            <span className="text-sm text-gray-400">已发 {posted} · 待发 {list.length - posted}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${list.length ? posted / list.length * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {list.map(s => {
        const done = !!s.posted_at
        const body = bodyFor(s, s.item)
        return (
          <div key={s.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden ${done ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-wrap">
              <span className="font-bold text-sm">{nameOf(s.account_id)}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                s.source_type === 'original' ? 'bg-red-50 text-red-700'
                : s.source_type === 'rewrite' ? 'bg-amber-50 text-amber-700'
                : 'bg-purple-50 text-purple-700'}`}>
                {SOURCE_LABEL[s.source_type]}
                {s.source_type === 'clone' && ' · 和原文一模一样'}
              </span>
              <span className="flex-1" />
              <span className="text-xs text-gray-400">
                {done ? `${hhmm(s.posted_at)} 已发` : `${s.kind === 'video' ? '视频' : '图文'} · ${s.item?.materials?.length || 0} 个素材`}
              </span>
            </div>

            {!done && (
              <div className="px-4 py-3 space-y-2.5">
                {s.item?.title && s.source_type === 'original' && (
                  <Field label="标题" onCopy={() => copy(s.item.title, `t${s.id}`)} copied={copied === `t${s.id}`}>
                    <p className="font-bold text-sm">{s.item.title}</p>
                  </Field>
                )}
                <Field label="正文" onCopy={() => copy(body, `b${s.id}`)} copied={copied === `b${s.id}`}>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{body}</p>
                </Field>
                {s.item?.materials?.length > 0 && (
                  <div className="flex items-start gap-2.5">
                    <span className="w-10 shrink-0 text-xs text-gray-400 pt-1.5">素材</span>
                    <div className="flex gap-1.5 flex-wrap items-center">
                      {s.item.materials.map((m, i) => (
                        <a key={i} href={m.url || m.data} target="_blank" rel="noreferrer" download={m.name}
                          className="w-14 h-14 rounded-lg overflow-hidden border border-gray-200 hover:border-red-400 bg-gray-100 flex items-center justify-center">
                          {s.kind === 'video'
                            ? <span className="text-xl">🎬</span>
                            : <img src={m.url || m.data} alt="" className="w-full h-full object-cover" />}
                        </a>
                      ))}
                      <span className="text-xs text-red-700 font-semibold flex items-center gap-1 ml-1">
                        <Download size={12} /> 点开另存
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-t border-gray-100">
              {done ? (
                <p className="flex-1 text-center text-sm font-semibold text-green-700 flex items-center justify-center gap-1.5">
                  <Check size={15} /> {hhmm(s.posted_at)} 已发
                </p>
              ) : (
                <>
                  <button disabled={busy} onClick={() => markPosted(s.id)}
                    className="flex-1 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg,#6b1414,#c0392b)' }}>
                    发完了，标记已发
                  </button>
                  <span className="text-xs text-gray-400 leading-snug">
                    点一下自动记进你的日报，<br />不用再填一遍
                  </span>
                </>
              )}
            </div>
          </div>
        )
      })}

      {list.length === 0 && (
        <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
          <p className="text-sm text-gray-500 leading-relaxed">
            今天没有待发的内容。<br />
            <span className="text-xs text-gray-400">
              只有「待发」的才会出现在这一页 —— 草稿、素材没传完的都不显示，
              你打开就是能直接发的。
            </span>
          </p>
        </div>
      )}
    </div>
  )
}

function Field({ label, children, onCopy, copied }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="w-10 shrink-0 text-xs text-gray-400 pt-1.5">{label}</span>
      <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2 min-w-0">{children}</div>
      <button onClick={onCopy}
        className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 ${
          copied ? 'bg-green-100 text-green-700' : 'text-white'}`}
        style={copied ? undefined : { background: 'linear-gradient(135deg,#6b1414,#c0392b)' }}>
        {copied ? <><Check size={11} />已复制</> : <><Copy size={11} />复制</>}
      </button>
    </div>
  )
}
