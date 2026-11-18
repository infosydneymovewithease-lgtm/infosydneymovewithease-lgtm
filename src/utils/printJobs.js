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
  try {
    // ⚠️ 必须有超时。2026-11-18 小洁在国内点了之后，按钮停在「发送中…」整整一分钟 ——
    //    supabase-js 的 rpc() 没有默认超时，网络卡住就永远不返回，
    //    她既不知道在发、也不知道已经死了，只能干等。
    //    宁可告诉她「超时了，再试一次」，也不能让她盯着一个不会变的按钮。
    const { data, error } = await Promise.race([
      supabase.rpc('enqueue_storage_label', {
        p_target_id: orderId,
        p_by: user?.id || null,
        p_by_name: user?.name || null,
      }),
      new Promise(r => setTimeout(() => r({ data: null, error: { message: '__timeout__' } }), 20000)),
    ])
    if (error?.message === '__timeout__') {
      return { ok: false, msg: '网络太慢，20 秒没回应。刷新页面看看是不是其实排上了，没有就再点一次' }
    }
    if (error) {
      // 迁移没跑时函数不存在 —— 说人话，别让师傅看到一串英文
      if (/does not exist|schema cache/i.test(error.message || '')) {
        return { ok: false, msg: '打印功能还没装好（SQL 50 没跑）' }
      }
      return { ok: false, msg: error.message || '排队失败' }
    }
    return data || { ok: false, msg: '没有返回结果' }
  } catch (e) {
    return { ok: false, msg: e.message || '网络不通' }
  }
}
