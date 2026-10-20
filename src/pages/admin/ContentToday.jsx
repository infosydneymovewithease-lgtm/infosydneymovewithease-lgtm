// 今天要发的 —— 发布页，2026-10-14
//
// ⚠️ 2026-10-18 晚：使用者不再按角色定，按【账号归属】定。
//    小红书迁喜/盼达 → 运营 Lili（owner_staff_id='lili'）
//    朋友圈/视频号   → 公共（owner 为空），谁在岗谁发
//    老板（admin）看得到全部，顶班时照常能发。
//    上午那版「只有 Annie 能发」的 IP 属地约束已经不适用 ——
//    小红书现在归 Lili，不经小洁的 VPN。
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
import { ownsAccount, requiredAccounts } from '../../utils/worklog'
import { uploadImage } from '../../utils/upload'
import { humanError } from '../../utils/netError'
import { Check, Copy, Download, Plus } from 'lucide-react'

// 老板 10-20：「在今天要发里看到的封面图片不能下载就变得没有意义了」
//
// Supabase Storage 支持 ?download= —— 服务器会回 Content-Disposition: attachment，
// 点一下直接存到本地。
// ⚠️ 不能只靠 <a download>：跨域时浏览器【会忽略】那个属性，
//    结果是在新标签页打开图片，她还得右键另存，手机上更麻烦。
//    原来视频那个「点开另存」就是这个毛病。
const dl = (u, name) => {
  if (!u || u.startsWith('data:')) return u     // base64 的本来就能存，download 属性有效
  return u + (u.includes('?') ? '&' : '?') + 'download=' + encodeURIComponent(name || 'cover.jpg')
}

const hhmm = iso => iso
  ? new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  : ''

export default function ContentToday() {
  const { user, config, getContentRange, markSlotPosted, getWorkday, saveInquiry,
          unmarkSlotPosted } = useApp()
  const [proof, setProof] = useState({})   // slotId → {url, shots}
  const date = sydneyToday()
  const [data, setData] = useState({ slots: [], items: [] })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState('')

  const refresh = useCallback(async () => setData(await getContentRange(date, date)), [getContentRange, date])
  useEffect(() => { refresh() /* eslint-disable-next-line */ }, [date])

  const nameOf = id => (config.channelAccounts || []).find(a => a.id === id)?.name || id
  // 老板 10-18：发布责任挂在【账号】上，不写死在代码里。
  // 上一版是 if (isManager)，换一次分工就要满系统找六个地方改（上次就漏了六处）。
  // 现在归属存在 channel_account.owner_staff_id，换人在系统设置里点一下就行。
  // ⚠️ 没指定负责人的号＝公共的，谁都看得到（微信那两个就是）。
  const seeAll = user?.role === 'admin'
  const mineOnly = s => ownsAccount(
    (config.channelAccounts || []).find(a => a.id === s.account_id), user?.id, seeAll)
  const list = todayToPost(data.slots, data.items, date).filter(mineOnly)
  const posted = list.filter(s => s.posted_at).length
  // 我负责的号 —— 下面那张「今天来了几个咨询」用它
  const myAccounts = requiredAccounts(config.channelAccounts, user?.id, seeAll)

  async function copy(text, key) {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1500) }
    catch { setErr('复制失败，手动选中复制吧') }
  }

  async function undoPosted(s) {
    if (!confirm(`撤销「${nameOf(s.account_id)}」这条的已发标记？\n\n` +
      `它会变回待发，日报里那一条发布记录也会一起删掉。\n` +
      `（确实发出去的内容不受影响 —— 删的只是系统里的记录）`)) return
    setBusy(true); setErr('')
    try { await unmarkSlotPosted(s.id); await refresh() }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  async function markPosted(id) {
    setBusy(true); setErr('')
    const p = proof[id] || {}
    try { await markSlotPosted(id, p.url, p.shots); await refresh() }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  const accOf = id => (config.channelAccounts || []).find(a => a.id === id)
  // 小红书和视频号要笔记链接 —— 能点开验证，而且以后能回填赞藏评。
  // 朋友圈没有链接可复制，而且内容是复用的，不值得加这个负担。
  const needsLink = s => { const a = accOf(s.account_id); return a?.platform !== '微信' || s.account_id === 'channels' }

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
                {done ? `${hhmm(s.posted_at)} 已发`
                  : s.kind === 'video' ? `视频 · ${s.item?.materials?.length || 0} 个文件`
                  : '图文 · 配图在微信素材群'}
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
                {/* 图片不在系统里 —— 老板 10-15：素材在微信素材群，
                    传进系统再下载是重复搬运。这里只给封面图认人 + 告诉她去群里哪儿找。
                    视频例外，群里会过期，所以仍然在系统里能直接下载。 */}
                {(s.item?.cover || s.item?.material_note) && s.kind !== 'video' && (
                  <div className="flex items-start gap-2.5">
                    <span className="w-10 shrink-0 text-xs text-gray-400 pt-1.5">配图</span>
                    <div className="flex-1 flex items-start gap-2.5 bg-gray-50 rounded-xl px-3 py-2">
                      {s.item.cover && (
                        <a href={dl(s.item.cover.url || s.item.cover.data, s.item.cover.name)}
                          download={s.item.cover.name || 'cover.jpg'} title="点一下存到本地"
                          className="shrink-0 relative group">
                          <img src={s.item.cover.url || s.item.cover.data} alt=""
                            className="w-14 h-14 rounded-lg object-cover border border-gray-200 group-hover:border-red-400" />
                          <span className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/40
                                           flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition">
                            <Download size={16} />
                          </span>
                        </a>
                      )}
                      <div className="min-w-0">
                        {s.item.material_note
                          ? <p className="text-sm leading-relaxed">{s.item.material_note}</p>
                          : <p className="text-sm text-gray-400">配图去微信素材群里找</p>}
                        {s.item.cover && (
                          <a href={dl(s.item.cover.url || s.item.cover.data, s.item.cover.name)}
                            download={s.item.cover.name || 'cover.jpg'}
                            className="text-xs text-red-700 font-semibold inline-flex items-center gap-1 mt-1">
                            <Download size={12} /> 下载封面图
                          </a>
                        )}
                        {/* 老板 10-20：「可以下载了但是不知道下载到哪里去了」
                            网页无权选择保存位置，这是浏览器的安全限制。
                            能做的是把最快的存法写在旁边 —— 手机上长按进相册，一步到位。 */}
                        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                          手机上<b className="text-gray-500">长按图片 →「存储到照片」</b>直接进相册，比点下载快。
                          <br />点下载的话：电脑在「下载」文件夹，手机在「文件」App 的下载项里。
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {s.kind === 'video' && s.item?.materials?.length > 0 && (
                  <div className="flex items-start gap-2.5">
                    <span className="w-10 shrink-0 text-xs text-gray-400 pt-1.5">视频</span>
                    <div className="flex gap-1.5 flex-wrap items-center">
                      {/* 视频的封面图也要能拿到 —— 视频号发布时要选封面，
                          有做好的比从视频里截一帧强。不显示出来等于白传。 */}
                      {s.item.cover && (
                        <a href={dl(s.item.cover.url || s.item.cover.data, s.item.cover.name)}
                          download={s.item.cover.name || 'cover.jpg'} title="封面图 · 点一下存到本地"
                          className="relative group shrink-0">
                          <img src={s.item.cover.url || s.item.cover.data} alt=""
                            className="w-14 h-14 rounded-lg object-cover border border-gray-200 group-hover:border-red-400" />
                          <span className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/40
                                           flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition">
                            <Download size={16} />
                          </span>
                          <span className="absolute -bottom-0.5 left-0 right-0 text-[9px] text-center text-white bg-black/50 rounded-b-lg">封面</span>
                        </a>
                      )}
                      {s.item.materials.map((m, i) => (
                        <a key={i} href={dl(m.url || m.data, m.name)} download={m.name}
                          className="w-14 h-14 rounded-lg border border-gray-200 hover:border-red-400 bg-gray-100 flex items-center justify-center">
                          <span className="text-xl">🎬</span>
                        </a>
                      ))}
                      <span className="text-xs text-red-700 font-semibold flex items-center gap-1 ml-1">
                        <Download size={12} /> 点一下就下载
                      </span>
                      {/* 视频没法长按存相册，只能走「文件」App 转一道 */}
                      <p className="w-full text-xs text-gray-400 mt-1 leading-relaxed">
                        存进相册：下载后打开<b className="text-gray-500">「文件」App → 下载项</b>，
                        点开视频 → 分享 → 存储视频。电脑上在「下载」文件夹。
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!done && (
              <div className="px-4 pb-3">
                {needsLink(s) ? (
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">
                      笔记链接 <span className="text-red-600">必填</span>
                      <span className="text-gray-300"> · App 里「分享 → 复制链接」</span>
                    </label>
                    <input value={proof[s.id]?.url || ''}
                      onChange={e => setProof(p => ({ ...p, [s.id]: { ...p[s.id], url: e.target.value } }))}
                      placeholder="粘贴刚发出去那条笔记的链接"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400" />
                    <p className="text-xs text-gray-400 mt-1">
                      贴了链接，三个月后才能回头看哪条选题真的带来了咨询 —— 截图给不了这个。
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">发布截图 <span className="text-gray-300">选填</span></label>
                    <ShotRow shots={proof[s.id]?.shots || []}
                      onChange={next => setProof(p => ({ ...p, [s.id]: { ...p[s.id], shots: next } }))}
                      onErr={setErr} />
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-t border-gray-100">
              {done ? (
                <p className="flex-1 text-center text-sm font-semibold text-green-700 flex items-center justify-center gap-1.5 flex-wrap">
                  <Check size={15} /> {hhmm(s.posted_at)} 已发
                  {s.proof_url && (
                    <a href={s.proof_url} target="_blank" rel="noreferrer"
                      className="text-xs font-normal text-gray-500 underline">看笔记</a>
                  )}
                  {/* 老板 10-20：「小红书发好了但是朋友圈是按错了」
                      手机上那个按钮很大，手指一滑就点到隔壁那条。
                      原来点错了只能找人改库。 */}
                  <button disabled={busy} onClick={() => undoPosted(s)}
                    className="text-xs font-normal text-gray-400 underline hover:text-red-600 disabled:opacity-40">
                    点错了，撤销
                  </button>
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

      {/* ── 今天来了几个咨询 ─────────────────────
          老板 10-18：「这部分数据回填给谁好一些呢」
          答案是按号分 —— 小红书的私信只落在运营手机上，客服看不到。
          放在这一页而不是日报里：运营每天本来就要开这一页，
          填完两个数就走，不用再背一整套出勤／配额／问题反馈的日报流程。
          存的还是 platform_inquiry 同一张表，所以团队今日和周月汇总照常合计。 */}
      {myAccounts.length > 0 && (
        <InquiryBox date={date} accounts={myAccounts} staffId={user?.id}
          getWorkday={getWorkday} saveInquiry={saveInquiry} onErr={setErr} />
      )}

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


// 朋友圈用：没有笔记链接可复制，只能截图
function ShotRow({ shots, onChange, onErr }) {
  const [up, setUp] = useState(false)
  async function add(files) {
    setUp(true)
    try {
      const next = [...shots]
      // ⚠️ uploadImage 返回的已经是 {name,url}（失败时 {name,data}）——
      //    再包一层 {name, url: 那个对象} 会让 url 变成对象，<img src> 拿到就是坏图。
      for (const f of files) next.push(await uploadImage(f))
      onChange(next)
    } catch (e) { onErr(e.message || '上传失败') } finally { setUp(false) }
  }
  return (
    <div className="flex gap-1.5 flex-wrap">
      {shots.map((sh, i) => (
        <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-200">
          <img src={sh.url || sh.data} alt="" className="w-full h-full object-cover" />
          <button onClick={() => onChange(shots.filter((_, j) => j !== i))}
            className="absolute top-0 right-0 bg-black/60 text-white text-xs w-4 h-4 leading-4 text-center">✕</button>
        </div>
      ))}
      <label className="w-14 h-14 rounded-lg border border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-red-400 text-gray-400">
        {up ? '…' : <Plus size={16} />}
        <input type="file" multiple accept="image/*" className="hidden"
          onChange={e => { add([...e.target.files]); e.target.value = '' }} />
      </label>
    </div>
  )
}


// ── 今天来了几个咨询 ────────────────────────────────────
// ⚠️ 判断「填了没有」看的是【有没有这条登记】，不是「人数大于 0」——
//    今天 0 个咨询也是有效登记，不能逼人填个假数字出来。
//    这一条和日报里的登记表是同一个规矩，别在这里走样。
function InquiryBox({ date, accounts, staffId, getWorkday, saveInquiry, onErr }) {
  const [saved, setSaved] = useState({})     // accountId → 已存进库的数字
  const [draft, setDraft] = useState({})     // accountId → 正在输入的
  const [busy, setBusy] = useState('')
  const [okFlash, setOkFlash] = useState('')

  const load = useCallback(async () => {
    const d = await getWorkday(date)
    const mine = (d.inquiries || []).filter(i => i.staff_id === staffId)
    setSaved(Object.fromEntries(mine.map(i => [i.account_id, String(i.count)])))
  }, [getWorkday, date, staffId])
  useEffect(() => { load() }, [load])

  // 「没存」的定义：输入框里有东西，而且和库里存的不一样。
  // ⚠️ 这个状态必须【看得见】—— 老板 10-20 转述经理的原话：
  //    「写完之后在哪里提交？我退出页面，我填的就没了。」
  //    原来是点到别处自动存，界面上没有任何反馈。对写代码的人理所当然，
  //    对用的人等于没有保存这回事。她填的 1 和 1 一条都没进库。
  const dirty = accounts.filter(a => {
    const d = draft[a.id]
    return d !== undefined && d !== '' && d !== saved[a.id]
  })

  async function saveOne(id) {
    const raw = draft[id]
    if (raw === undefined || raw === '') return
    setBusy(id); onErr('')
    try {
      await saveInquiry(date, id, Number(raw) || 0)
      setSaved(p => ({ ...p, [id]: String(Number(raw) || 0) }))
      setDraft(p => { const n = { ...p }; delete n[id]; return n })
      setOkFlash(id); setTimeout(() => setOkFlash(''), 1500)
    } catch (e) {
      // ⚠️ 失败时【不清空输入框】—— 她的数字还在里面，点重试就行，不用重打
      onErr(humanError(e, '这个数字'))
    } finally { setBusy('') }
  }

  async function saveAll() {
    for (const a of dirty) await saveOne(a.id)
  }

  const missing = accounts.filter(a => saved[a.id] === undefined)

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <h2 className="font-bold text-sm">今天来了几个咨询</h2>
      <p className="text-xs text-gray-400 mt-0.5 mb-3 leading-relaxed">
        私信里问搬家的人数，填你自己接待的。
        <b className="text-gray-500">今天 0 个也要填 0</b> —— 空着不算登记。
        这个数系统抓不到，只有你看得见，但它是判断哪类文案真的带来客人的唯一依据。
      </p>
      <div className="space-y-1.5">
        {accounts.map(a => {
          const has = saved[a.id] !== undefined
          const val = draft[a.id] ?? (has ? saved[a.id] : '')
          const isDirty = dirty.some(x => x.id === a.id)
          return (
            <div key={a.id} className="flex items-center gap-2.5 py-1">
              <span className="w-2 h-2 rounded-full shrink-0"
                style={{ background: isDirty ? '#ef4444' : has ? '#22c55e' : '#f59e0b' }} />
              <span className="text-xs text-gray-400 w-12 shrink-0">{a.platform}</span>
              <span className="text-sm font-semibold w-20 shrink-0">{a.name}</span>
              <span className="text-xs text-gray-400 flex-1 truncate min-w-0 hidden sm:block">{a.positioning}</span>
              <input type="number" min="0" inputMode="numeric" value={val}
                onChange={e => setDraft(d => ({ ...d, [a.id]: e.target.value }))}
                onBlur={() => isDirty && saveOne(a.id)}
                disabled={busy === a.id}
                placeholder="待填"
                className={`w-16 text-center border rounded-lg px-2 py-1.5 text-sm outline-none shrink-0
                  ${isDirty ? 'border-red-300 bg-red-50' : has ? 'border-gray-200' : 'border-amber-300 bg-amber-50'}
                  focus:border-red-400`} />
              <span className="w-14 shrink-0 text-xs text-right">
                {busy === a.id ? <span className="text-gray-400">存…</span>
                  : isDirty ? (
                    <button onClick={() => saveOne(a.id)}
                      className="font-semibold text-white px-2 py-1 rounded-lg"
                      style={{ background: 'linear-gradient(135deg,#6b1414,#c0392b)' }}>保存</button>
                  ) : okFlash === a.id ? <span className="text-green-600 font-semibold">✓ 已存</span>
                  : has ? <span className="text-green-600">✓ 已存</span>
                  : <span className="text-amber-600">待填</span>}
              </span>
            </div>
          )
        })}
      </div>

      {/* 一个明确的提交入口 —— 经理问的就是这个。
          哪怕自动保存已经跑过了，也要有个看得见的按钮，否则她不知道东西进没进去。 */}
      {dirty.length > 0 && (
        <button onClick={saveAll} disabled={!!busy}
          className="mt-3 w-full text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#6b1414,#c0392b)' }}>
          保存这 {dirty.length} 个数字
        </button>
      )}

      {dirty.length > 0 ? (
        <p className="text-xs text-red-600 mt-2 font-medium">
          红色的还没存进系统 —— 现在离开页面就没了
        </p>
      ) : missing.length > 0 ? (
        <p className="text-xs text-amber-700 mt-2.5">
          还差 {missing.map(a => a.name).join('、')} 没填 —— 下班前补上
        </p>
      ) : (
        <p className="text-xs text-green-600 mt-2.5">今天的咨询数都登记好了 ✓</p>
      )}
    </div>
  )
}
