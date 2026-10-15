// 写作提示词库 —— 2026-10-15
//
// 老板 10-15：「我想她也是用 AI 写作，最有可能是豆包或者 GPT 这两个，
//              我怕她要求不清写出来的东西效果不好凑数」
//
// 所以不防 AI，直接给好提示词。核心设计：
//   提示词是【一张要她填真实素材的表】，不是一句咒语。
//   只打「写一篇搬家文案」，豆包会编一堆没去过现场的套话 —— 那就是凑数。
//   现场细节是竞争对手抄不走的唯一资产，必须由人提供，AI 只负责组织。
//
// 提示词存数据库不写死在代码里 —— 老板改一句话不该来找人改代码重新部署。

import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react'

export default function PromptLibrary() {
  const { listContentPrompts } = useApp()
  const [list, setList] = useState([])
  const [open, setOpen] = useState(null)
  const [copied, setCopied] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => { listContentPrompts().then(setList) /* eslint-disable-next-line */ }, [])

  async function copy(p) {
    try { await navigator.clipboard.writeText(p.body); setCopied(p.id); setTimeout(() => setCopied(null), 1800) }
    catch { setErr('复制失败，展开后手动选中复制') }
  }

  if (!list.length) return null

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <h2 className="font-bold text-sm">写作提示词</h2>
      <p className="text-xs text-gray-400 mt-0.5 mb-3 leading-relaxed">
        复制整段粘给豆包或 ChatGPT，<b className="text-gray-600">把【真实素材】那几行填上再发</b>。
        不填素材的话 AI 只会编出没去过现场的套话 —— 现场细节是我们唯一抄不走的东西。
      </p>

      {err && <p className="text-xs text-red-600 mb-2">{err}</p>}

      <div className="space-y-1.5">
        {list.map(p => {
          const isOpen = open === p.id
          const isCheck = p.kind === 'check'
          return (
            <div key={p.id} className={`border rounded-xl overflow-hidden ${
              isCheck ? 'border-green-200 bg-green-50/40' : 'border-gray-200'}`}>
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button onClick={() => setOpen(isOpen ? null : p.id)}
                  className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
                  {isOpen ? <ChevronDown size={14} className="text-gray-400 shrink-0" />
                          : <ChevronRight size={14} className="text-gray-400 shrink-0" />}
                  <span className="text-sm font-semibold truncate">{p.title}</span>
                </button>
                <button onClick={() => copy(p)}
                  className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 ${
                    copied === p.id ? 'bg-green-100 text-green-700' : 'text-white'}`}
                  style={copied === p.id ? undefined : { background: 'linear-gradient(135deg,#6b1414,#c0392b)' }}>
                  {copied === p.id ? <><Check size={11} />已复制</> : <><Copy size={11} />复制</>}
                </button>
              </div>

              {p.scene && !isOpen && (
                <p className="px-3 pb-2.5 -mt-1 text-xs text-gray-400 leading-relaxed">{p.scene}</p>
              )}

              {isOpen && (
                <div className="px-3 pb-3">
                  {p.scene && (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-2.5 py-2 mb-2 leading-relaxed">
                      {p.scene}
                    </p>
                  )}
                  <pre className="text-xs text-gray-700 bg-gray-50 rounded-lg px-3 py-2.5 whitespace-pre-wrap
                                  leading-relaxed font-sans max-h-80 overflow-y-auto">{p.body}</pre>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-dashed border-gray-200 leading-relaxed">
        这些规则是 10/15 查的小红书运营规范 + 老板实际改稿三轮的结论：
        标题 ≤14 字 · 核心词正文出现 3–5 次 · 标签 1 大 + 2 中 + 1 长尾 ·
        缺点前置可信度提升 3–5 倍 · <b className="text-gray-600">商家号不能装用户</b>。
      </p>
    </div>
  )
}
