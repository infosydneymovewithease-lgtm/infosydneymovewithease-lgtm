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
    const { data, error } = await supabase.rpc('enqueue_storage_label', {
      p_target_id: orderId,
      p_by: user?.id || null,
      p_by_name: user?.name || null,
    })
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
