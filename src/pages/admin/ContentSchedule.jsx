// 内容排期 —— 经理（佳慧）视角，2026-10-14
//
// 老板：「经理打开就是知道要编辑那些内容，而后制作上传，图片，视频」
//
// 两个设计决定值得记下来：
//  ① 格子【每周自动生成】，不让人手建 15 条 —— 那个工作量本身就会让人放弃
//  ② 每个格子能【跳过并填原因】 —— 内容排期表的典型死法是：
//     第 1 周欠 5 条、第 2 周欠 11 条、第 3 周一片红、第 4 周没人打开。
//     有了「跳过」，落后变成一个有记录的决定，而不是一笔越滚越大的烂账。

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { sydneyToday } from '../../utils/date'
import {
  weekGrid, weekStats, scheduleTodos, slotStatus, itemReady,
  SOURCE_LABEL, STATUS_LABEL, mondayOf, addDaysLocal,
} from '../../utils/content'
import { uploadImage } from '../../utils/upload'
import PromptLibrary from '../../components/PromptLibrary'
import { ChevronLeft, ChevronRight, Plus, Check } from 'lucide-react'

const WEEK = ['一', '二', '三', '四', '五', '六', '日']

const CELL = {
  empty:   'bg-gray-50 border-dashed border-gray-300 text-gray-400',
  draft:   'bg-amber-50 border-amber-300 text-amber-800',
  ready:   'bg-green-50 border-green-300 text-green-800',
  posted:  'bg-gray-100 border-gray-200 text-gray-400',
  skipped: 'bg-gray-50 border-gray-200 text-gray-400 line-through',
}

export default function ContentSchedule() {
  const { user, config, getContentRange, generateWeekSlots, autolinkWeek,
          saveContentItem, updateSlot, skipSlot } = useApp()
  const today = sydneyToday()
  const [monday, setMonday] = useState(() => mondayOf(today))
  const [data, setData] = useState({ slots: [], items: [], rules: [] })
  const [open, setOpen] = useState(null)      // 正在编辑的格子
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const sunday = addDaysLocal(monday, 6)
  const refresh = useCallback(async () => setData(await getContentRange(monday, sunday)),
    [getContentRange, monday, sunday])
  useEffect(() => { refresh() /* eslint-disable-next-line */ }, [monday])

  const nameOf = id => (config.channelAccounts || []).find(a => a.id === id)?.name || id
  const grid  = useMemo(() => weekGrid(data.slots, data.items, monday, config.channelAccounts),
    [data, monday, config.channelAccounts])
  const stats = useMemo(() => weekStats(data.slots, data.items), [data])
  const todos = useMemo(() => scheduleTodos(data.slots, data.items, today, nameOf),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, today])

  async function run(fn, okMsg) {
    setBusy(true); setErr(''); setMsg('')
    try { const r = await fn(); await refresh(); if (okMsg) setMsg(okMsg(r)) }
    catch (e) { setErr(e.message || '操作失败') } finally { setBusy(false) }
  }

  const videoDone = stats.videos.filter(s => s.posted_at).length

  return (
    <div className="p-5 max-w-5xl mx-auto space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">内容排期</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {monday} – {sunday} · 格子每周按定额自动生成，你只管往里填
          </p>
        </div>
        <div className="flex items-center bg-white rounded-xl shadow-sm">
          <button onClick={() => setMonday(addDaysLocal(monday, -7))} className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg"><ChevronLeft size={18} /></button>
          <span className="px-2 text-sm font-semibold">{monday === mondayOf(today) ? '本周' : monday}</span>
          <button onClick={() => setMonday(addDaysLocal(monday, 7))} className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg"><ChevronRight size={18} /></button>
        </div>
      </div>

      {(err || msg) && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[90%] rounded-xl px-4 py-3 shadow-lg flex items-start gap-2 ${
          err ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'}`}>
          <span className="text-sm flex-1 leading-relaxed">{err || msg}</span>
          <button onClick={() => { setErr(''); setMsg('') }} className="opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* ── 顶部数字 ─────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <Kpi label="本周要发" value={`${stats.total} 次`} />
        <Kpi label="还要做的" value={`${stats.todo} 条`} warn={stats.todo > 0} />
        <Kpi label="视频" value={`${videoDone}/${stats.videos.length}`} warn={videoDone < stats.videos.length} />
        <Kpi label="已就绪" value={`${stats.ready}/${stats.total}`} />
        <Kpi label="复用省下" value={`${stats.reused} 条`} />
      </div>

      {/* ── 没格子就先生成 ─────────────────── */}
      {data.slots.length === 0 && (
        <div className="bg-white rounded-2xl p-5 text-center shadow-sm">
          <p className="text-sm text-gray-600 mb-3">这一周还没有格子</p>
          <button disabled={busy} onClick={() => run(() => generateWeekSlots(monday), r => `生成了 ${r.created} 个格子`)}
            className="text-white font-bold px-5 py-2.5 rounded-xl text-sm disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#6b1414,#c0392b)' }}>
            按定额生成本周格子
          </button>
          <p className="text-xs text-gray-400 mt-2.5">迁喜 3 · 盼达 3 · 朋友圈 7 · 视频号 2 ＝ 15 个</p>
        </div>
      )}

      {/* ── 待办 ──────────────────────────── */}
      {todos.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold text-sm mb-2">需要你处理</h2>
          <div className="space-y-1">
            {todos.slice(0, 8).map((t, i) => (
              <button key={i} onClick={() => setOpen(data.slots.find(s => s.id === t.slotId))}
                className={`block w-full text-left text-sm hover:underline ${t.sev === 'high' ? 'text-red-600' : 'text-amber-600'}`}>
                {t.sev === 'high' ? '🔴' : '🟠'} {t.text}
              </button>
            ))}
            {todos.length > 8 && <p className="text-xs text-gray-400 pt-1">还有 {todos.length - 8} 条…</p>}
          </div>
        </div>
      )}

      {/* ── 本周格子 ───────────────────────── */}
      {data.slots.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm overflow-x-auto">
          <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
            <h2 className="font-bold text-sm">本周格子</h2>
            <div className="flex gap-2">
              <button disabled={busy} onClick={() => run(() => autolinkWeek(monday), r => `自动关联了 ${r.linked} 个复用格子`)}
                className="text-xs font-semibold text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-40">
                一键关联复用
              </button>
              <button disabled={busy} onClick={() => run(() => generateWeekSlots(monday), r => r.created ? `补了 ${r.created} 个格子` : '格子已经齐了')}
                className="text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40">
                补生成
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-3 leading-relaxed">
            一条内容可以发到多个号 —— 迁喜文案直接复刻到朋友圈，盼达文案改写后复用，视频转发 1 条。
            朋友圈 7 条全部来自复用，不用单独写。
          </p>

          <div className="min-w-[760px]">
            <div className="grid gap-1.5" style={{ gridTemplateColumns: '76px repeat(7, 1fr)' }}>
              <div />
              {Array.from({ length: 7 }, (_, i) => {
                const d = addDaysLocal(monday, i)
                return (
                  <div key={d} className={`text-xs text-center font-semibold pb-1 ${d === today ? 'text-red-700' : 'text-gray-400'}`}>
                    {WEEK[i]} {d.slice(8)}
                  </div>
                )
              })}

              {grid.map(row => (
                <Row key={row.accountId} row={row} nameOf={nameOf} onOpen={setOpen} />
              ))}
            </div>
          </div>

          <div className="flex gap-3 text-xs text-gray-400 mt-3 flex-wrap">
            <Legend cls="bg-gray-50 border-dashed border-gray-300">空</Legend>
            <Legend cls="bg-amber-50 border-amber-300">草稿 / 素材未齐</Legend>
            <Legend cls="bg-green-50 border-green-300">待发（小洁看得到）</Legend>
            <Legend cls="bg-gray-100 border-gray-200">已发</Legend>
          </div>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">
            ⚠️ 每个格子都能「跳过本周」并填原因 —— 做不到的格子要能合上，
            否则第三周整张表全红，然后再没人打开它。
          </p>
        </div>
      )}

      {/* 写作提示词 —— 放在格子下面。她先看待办知道要写什么，再翻这里拿提示词 */}
      <PromptLibrary />

      {open && (
        <SlotEditor slot={open} data={data} nameOf={nameOf} busy={busy}
          onClose={() => setOpen(null)}
          onSaveItem={saveContentItem} onUpdateSlot={updateSlot} onSkip={skipSlot}
          onDone={async () => { await refresh(); setOpen(null) }}
          onErr={setErr} />
      )}
    </div>
  )
}

function Row({ row, nameOf, onOpen }) {
  return (
    <>
      <div className="text-xs font-semibold flex items-center">{nameOf(row.accountId)}</div>
      {row.cells.map(c => (
        <div key={c.date} className="min-h-[56px] flex flex-col gap-1">
          {c.slots.length === 0 && <div className="flex-1 rounded-lg bg-gray-50/60" />}
          {c.slots.map(s => (
            <button key={s.id} onClick={() => onOpen(s)}
              className={`flex-1 rounded-lg border px-1.5 py-1 text-left text-[10px] leading-tight ${CELL[s.status]}`}>
              <span className="block font-bold truncate">
                {s.item?.title || (s.status === 'empty' ? '＋ 待填' : '未命名')}
              </span>
              <span className="block mt-0.5 opacity-80">
                {STATUS_LABEL[s.status]} · {SOURCE_LABEL[s.source_type]}
              </span>
            </button>
          ))}
        </div>
      ))}
    </>
  )
}

function Legend({ cls, children }) {
  return <span className="flex items-center gap-1"><i className={`w-2.5 h-2.5 rounded-sm border ${cls}`} />{children}</span>
}

function Kpi({ label, value, warn }) {
  return (
    <div className={`rounded-xl px-3 py-2.5 shadow-sm ${warn ? 'bg-amber-50 border border-amber-200' : 'bg-white'}`}>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${warn ? 'text-amber-700' : 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

// ── 格子编辑 ────────────────────────────────────────────────
function SlotEditor({ slot, data, nameOf, busy, onClose, onSaveItem, onUpdateSlot, onSkip, onDone, onErr }) {
  const item = data.items.find(i => i.id === slot.item_id) || null
  const isRewrite = slot.source_type === 'rewrite'
  const isDerived = slot.source_type !== 'original'

  const [title, setTitle] = useState(item?.title || '')
  const [body, setBody] = useState(item?.body || '')
  const [mats, setMats] = useState(item?.materials || [])
  const [override, setOverride] = useState(slot.body_override || '')
  const [pickId, setPickId] = useState(slot.item_id || '')
  const [skipping, setSkipping] = useState(false)
  const [reason, setReason] = useState('')
  const [up, setUp] = useState(false)
  const [saving, setSaving] = useState(false)

  const status = slotStatus(slot, item)

  async function addFiles(files) {
    setUp(true)
    try {
      const next = [...mats]
      for (const f of files) next.push({ name: f.name, url: await uploadImage(f) })
      setMats(next)
    } catch (e) { onErr(e.message || '上传失败') } finally { setUp(false) }
  }

  async function save() {
    setSaving(true)
    try {
      if (isDerived) {
        await onUpdateSlot(slot.id, {
          item_id: pickId ? Number(pickId) : null,
          ...(isRewrite ? { body_override: override } : {}),
        })
      } else {
        const id = await onSaveItem(slot.item_id, { kind: slot.kind, title, body, materials: mats })
        if (!slot.item_id) await onUpdateSlot(slot.id, { item_id: id })
      }
      await onDone()
    } catch (e) { onErr(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3.5 flex items-center gap-2.5 flex-wrap">
          <span className="font-bold text-sm">{slot.slot_date} · {nameOf(slot.account_id)}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
            slot.source_type === 'original' ? 'bg-red-50 text-red-700'
            : isRewrite ? 'bg-amber-50 text-amber-700' : 'bg-purple-50 text-purple-700'}`}>
            {SOURCE_LABEL[slot.source_type]}
          </span>
          <span className="text-xs text-gray-400">{STATUS_LABEL[status]}</span>
          <span className="flex-1" />
          {slot.due_date && !slot.posted_at && (
            <span className="text-xs text-gray-400">准备截止 {slot.due_date}</span>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg leading-none">✕</button>
        </div>

        <div className="px-5 py-4 space-y-3.5">
          {slot.posted_at && (
            <p className="bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-500">
              这条已经发布了，不能再改。
            </p>
          )}

          {isDerived ? (
            <>
              <div>
                <label className="text-xs text-gray-400 block mb-1">用哪一条内容</label>
                <select value={pickId} onChange={e => setPickId(e.target.value)} disabled={!!slot.posted_at}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400">
                  <option value="">—— 还没选 ——</option>
                  {data.items.filter(i => i.kind === slot.kind).map(i => (
                    <option key={i.id} value={i.id}>
                      #{i.id} {i.title || '(无标题)'}{itemReady(i) ? '' : '（还没做好）'}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {slot.source_type === 'clone' && '复刻＝一字不改。发布时自动去掉 #话题标签 —— 朋友圈用不上。'}
                  {slot.source_type === 'repost' && '转发＝直接把视频号那条转到朋友圈。'}
                  {isRewrite && '改写＝你提前改好一版存在这里，小洁发的时候一键复制，不用停下来改。'}
                </p>
              </div>

              {isRewrite && (
                <div>
                  <label className="text-xs text-gray-400 block mb-1">
                    改写版正文 <span className="text-red-600">（空着的话小洁发的时候没东西可复制）</span>
                  </label>
                  <textarea rows={6} value={override} onChange={e => setOverride(e.target.value)} disabled={!!slot.posted_at}
                    placeholder={data.items.find(i => i.id === Number(pickId))?.body || '先在上面选一条内容，然后把原文改成适合朋友圈的版本'}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400 resize-none leading-relaxed" />
                  <p className="text-xs text-gray-400 mt-1">
                    盼达是写给留学生的，朋友圈的人多半已经加过微信、甚至下过单 —— 口气要换。
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="text-xs text-gray-400 block mb-1">标题</label>
                <input value={title} onChange={e => setTitle(e.target.value)} disabled={!!slot.posted_at}
                  placeholder="小红书标题，20 字以内更好"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">正文</label>
                <textarea rows={8} value={body} onChange={e => setBody(e.target.value)} disabled={!!slot.posted_at}
                  placeholder={'正文…\n\n#悉尼搬家 #留学生搬家'}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400 resize-none leading-relaxed" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  {slot.kind === 'video' ? '视频素材' : '图片'}
                  {slot.kind === 'video' && <span className="text-amber-700"> · 提前 3 天，当天传来不及</span>}
                </label>
                <div className="flex gap-2 flex-wrap items-center">
                  {mats.map((m, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
                      {slot.kind === 'video' ? <span className="text-xl">🎬</span>
                        : <img src={m.url || m.data} alt="" className="w-full h-full object-cover" />}
                      {!slot.posted_at && (
                        <button onClick={() => setMats(mats.filter((_, j) => j !== i))}
                          className="absolute top-0 right-0 bg-black/60 text-white text-xs w-4 h-4 leading-4 text-center">✕</button>
                      )}
                    </div>
                  ))}
                  {!slot.posted_at && (
                    <label className="w-16 h-16 rounded-lg border border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-red-400 text-gray-400">
                      {up ? '…' : <Plus size={18} />}
                      <input type="file" multiple accept={slot.kind === 'video' ? 'video/*' : 'image/*'} className="hidden"
                        onChange={e => { addFiles([...e.target.files]); e.target.value = '' }} />
                    </label>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {!slot.posted_at && (
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 space-y-2">
            {skipping ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                <p className="text-xs text-amber-900 font-semibold mb-1.5">跳过这个格子，写一句为什么</p>
                <input value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="例如：这周顶班太多，没时间做视频"
                  className="w-full border border-amber-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-amber-500" />
                <div className="flex gap-2 mt-1.5">
                  <button disabled={busy || reason.trim().length < 2}
                    onClick={async () => { try { await onSkip(slot.id, reason); await onDone() } catch (e) { onErr(e.message) } }}
                    className="text-xs text-white font-semibold px-3 py-1.5 rounded-lg bg-amber-600 disabled:opacity-40">确认跳过</button>
                  <button onClick={() => setSkipping(false)} className="text-xs text-gray-500 px-2">取消</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button disabled={saving} onClick={save}
                  className="flex-1 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#6b1414,#c0392b)' }}>
                  {saving ? '保存中…' : '保存'}
                </button>
                <button onClick={() => setSkipping(true)}
                  className="text-sm font-semibold text-gray-500 border border-gray-200 rounded-xl px-4 hover:bg-gray-50">
                  跳过本周
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
