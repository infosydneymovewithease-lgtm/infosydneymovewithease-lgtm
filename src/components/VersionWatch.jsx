// 版本检测 —— 2026-10-20
//
// 为什么要有这个：2026-10-20 一天之内被同一件事坑了四次 ——
//   运营看到的是全套菜单（旧角色表）、经理打卡报英文错、客服看不到新菜单、
//   老板手机上少了七项功能。四次都查了代码和数据库，四次代码都是对的，
//   四次的真相都是「这个标签页开了很久，跑的是旧代码」。
//
// iOS 的标签页挂一天是常态，而且系统会直接从内存恢复页面，一个请求都不发。
// 国内客服网络不稳，更不会主动刷新。
//
// 做法：隔一段时间（和每次切回页面时）去服务器拿一次 index.html，
//       看里面引的 JS 文件名变了没有。Vite 是按内容算哈希的，
//       文件名变了就等于代码变了。
//
// ⚠️ 只提示，不自动刷新 —— 她可能正在写文案或者填日报，
//    直接 reload 会把没保存的东西冲掉。那比看到旧菜单严重得多。

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

const RE = /assets\/index-[A-Za-z0-9_-]+\.js/

function current() {
  const el = document.querySelector('script[src*="/assets/index-"]')
  const m = el?.getAttribute('src')?.match(RE)
  return m ? m[0] : null
}

export default function VersionWatch() {
  const [stale, setStale] = useState(false)

  useEffect(() => {
    const mine = current()
    if (!mine) return          // 开发环境（vite dev）没有这个文件名，不检测
    let alive = true

    async function check() {
      if (stale || document.hidden) return
      try {
        const res = await fetch('/?v=' + Date.now(), { cache: 'no-store' })
        const html = await res.text()
        const m = html.match(RE)
        if (alive && m && m[0] !== mine) setStale(true)
      } catch { /* 网络不好就算了，下次再说 */ }
    }

    check()
    const id = setInterval(check, 10 * 60 * 1000)   // 每 10 分钟
    window.addEventListener('focus', check)          // 切回这个页面时也看一眼
    document.addEventListener('visibilitychange', check)
    return () => {
      alive = false
      clearInterval(id)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale])

  if (!stale) return null

  return (
    <button onClick={() => window.location.reload()}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] max-w-[92%]
                 bg-gray-900 text-white rounded-xl shadow-lg px-4 py-3
                 flex items-center gap-2.5 text-sm active:scale-95 transition">
      <RefreshCw size={16} className="shrink-0" />
      <span className="text-left leading-relaxed">
        系统更新了 —— <b>点这里刷新</b>
        <span className="block text-xs text-white/60">不刷新的话，新功能不会出现在菜单里</span>
      </span>
    </button>
  )
}
