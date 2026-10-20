// 网络错误识别与翻译 —— 2026-10-20
//
// 客服和运营都在国内，走 VPN 连 supabase.co（后面是 Cloudflare）。
// 线路抖一下，请求就断在半路，浏览器抛的是 "TypeError: Load failed"
// （Safari）或 "Failed to fetch"（Chrome）。
//
// 这句话对她们毫无意义，而且会被当成「系统坏了」上报 ——
// 2026-10-20 一天之内发生两次：经理打卡、经理打开内容排期。
//
// ⚠️ 只翻译网络错误。权限、数据那类后端错误要原样留着 —— 那是排查线索。

const NET = /Load failed|Failed to fetch|NetworkError|ERR_NETWORK|ERR_INTERNET|timeout|aborted|socket/i

export function isNetworkError(e) {
  return NET.test(String(e?.message || e || ''))
}

/** 给用户看的话。网络类翻译掉，其余原样。 */
export function humanError(e, what = '这次操作') {
  const m = String(e?.message || e || '')
  if (isNetworkError(m)) {
    return `连不上服务器 —— 检查一下 VPN 是不是断了，或者换个网络再试一次。${what}没有生效，重试不会出错。`
  }
  return m || '操作失败'
}

/** 读数据失败时的提示。和写失败分开 —— 读失败最大的危险是【看起来像没有数据】。 */
export function readFailMsg(e) {
  return isNetworkError(e)
    ? '数据没加载出来 —— 网络连不上服务器（多半是 VPN）。这不代表数据没了，别急着重新生成。'
    : `数据没加载出来：${String(e?.message || e || '未知错误')}`
}
