// 后台新单提示音 — 用 Web Audio API 合成，无需音频文件
// Why: 客户自助下单 / 新订单进来时提醒客服，避免漏单
// 用法：playDing()（静音偏好由调用方读 localStorage 'admin_inbox_muted' 判断）
let _audioCtx = null

function tone(ctx, freq, startOffset, dur = 0.18, vol = 0.5) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  osc.connect(gain).connect(ctx.destination)
  const t = ctx.currentTime + startOffset
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(vol, t + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
  osc.start(t)
  osc.stop(t + dur)
}

// 「叮咚」连响两遍，音量 0.5（比旧版 0.25 更明显）
export function playDing() {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const ctx = _audioCtx
    // 标签页切回前台时 AudioContext 可能被挂起，先恢复
    if (ctx.state === 'suspended') ctx.resume()
    // freq, startOffset —— 880→660 为一组「叮咚」，间隔 0.5s 再来一组
    ;[[880, 0], [660, 0.18], [880, 0.5], [660, 0.68]].forEach(([f, off]) => tone(ctx, f, off))
  } catch (e) {
    console.warn('[ding] play failed (浏览器可能需要用户先交互)', e)
  }
}
