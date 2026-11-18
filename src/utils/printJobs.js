// 远程打印 —— 网页上点一下，悉尼那台打印机出纸
//
// 2026-11-18。老板当天干活时卡住了：
//   「我在寄存的时候没有可以贴在客户纸箱上的东西，我就无法完成照相和录像，
//     无法做这些就无法提交订单」
//   入库凭证要拍【订单号】那张照片，没贴纸就拍不了，整单交不上去。
//
// 链路：这里入队 → Supabase print_jobs → Mac mini 每 10 秒轮询 → lpr 打印
//       守护进程在 ~/qianxi-print/打印服务.cjs
//
// ⚠️ 内容不由前端传，只传订单 id ——
//    payload 由数据库在入队那一刻从 storage_orders 现读。
//    这样前端伪造不了，而且之后有人改了件数，已打的标签还对得上。

import { supabase } from '../lib/supabase'

/**
 * 排一张寄存标签的打印任务。
 * @returns {{ok:boolean, msg:string, count?:number}}
 */
export async function printStorageLabels(orderId, user) {
  // ⚠️ 2026-11-18 第二版。第一版用 supabase.rpc() + Promise.race 做超时，
  //    小洁那边点下去停在「发送中…」两分钟，20 秒的超时压根没触发 ——
  //    说明她拿到的还是旧包（Safari 的强制刷新不是 ⌘⇧R）。
  //    但不该靠「她刷对了」才正常。这版改成直接 fetch + AbortController：
  //      · 超时由浏览器层面掐断，不依赖任何库的行为
  //      · 不管网络怎么卡，15 秒一定有结果
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 15000)
  try {
    const r = await fetch(`${url}/rest/v1/rpc/enqueue_storage_label`, {
      method: 'POST',
      headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_target_id: orderId,
        p_by: user?.id || null,
        p_by_name: user?.name || null,
      }),
      signal: ac.signal,
    })
    if (!r.ok) {
      const t = await r.text().catch(() => '')
      if (r.status === 404) return { ok: false, msg: '打印功能还没装好（SQL 50 没跑）' }
      return { ok: false, msg: `服务器拒绝了（${r.status}）${t.slice(0, 80)}` }
    }
    return await r.json()
  } catch (e) {
    if (e.name === 'AbortError') {
      return { ok: false, msg: '15 秒没回应 —— 你的网络到服务器这段不通。换个网络再试，或者让悉尼这边代点' }
    }
    return { ok: false, msg: `发不出去：${e.message || '网络不通'}` }
  } finally {
    clearTimeout(timer)
  }
}
