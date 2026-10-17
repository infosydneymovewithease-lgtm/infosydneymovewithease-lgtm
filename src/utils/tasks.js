// 今天的进度 —— 2026-10-15
//
// 老板 10-12 最早提的：
//   「如果有一个提示告诉她到现在为止我们已经完成了多少今天要在日报上完成的任务，
//     还有什么没有完成。建议什么什么…这样就可以把量化的内容哪一个没有做的
//     已经做的都递到手边了」
//
// 他观察到的真问题：客服会有「漫无目的」的时候 —— 没人咨询的时候这份工作
// 没有自然结构。而系统明明知道今天还差什么，却憋到晚上 20:00 才说。
// 同一句话 14:00 说出来是可执行的，20:00 说出来只是个路障。
//
// 三个设计决定（都是和老板讨论后定的）：
//   ① 常驻面板，不弹窗 —— 她「漫无目的」那一刻本来就是抬头看屏幕的；
//      弹窗会训练出「关掉」的反射，而且正在跟客人聊时弹窗最讨厌
//   ② 带时长估算 —— 「还差 2 项」是压力，「还差 12 分钟」是可以当下决定做不做的事
//   ③ 日任务和周任务分开 —— 周目标混进日清单里天天显示红的，她会学会无视
//
// ⚠️ 还有一个「等待」态。少了它，她每天都会看到不是自己造成的红色，
//    然后学会无视整个面板 —— 那就前功尽弃了。

export const S = { done: 'done', todo: 'todo', wait: 'wait', skip: 'skip' }

/**
 * @returns [{ key, label, state, hint, minutes, to }]
 */
export function todayTasks(ctx) {
  const {
    role, log, inquiryOk, inquiryMissing, slotsToday, quota,
    openDays, editedToday, nameOfAccount,
  } = ctx
  const isManager = role === 'admin' || role === 'manager'
  const t = []

  t.push({
    key: 'clock', label: '上班打卡',
    state: log?.clock_in ? S.done : S.todo,
    // 打卡按钮就在这块面板【上面那张出勤卡】里，所以不给跳转链接，
    // 而是直接告诉她往上看 —— 跳到别的页反而绕远。
    hint: log?.clock_in ? null : '点上面那张卡的「上班打卡」· 不打卡交不了日报',
    minutes: 0,
  })

  // 经理第一件事是核昨天的账（老板定的 T+1 流程）
  if (isManager) {
    const n = (openDays || []).length
    t.push({
      key: 'reconcile', label: '核对昨天的账和客服日报',
      state: n === 0 ? S.done : S.todo,
      hint: n === 0 ? '前 7 天都闭环了' : `还有 ${n} 天没闭环`,
      minutes: n * 15, to: '/admin/team-today',
    })
  }

  t.push({
    key: 'inquiry', label: '平台咨询登记',
    state: inquiryOk ? S.done : S.todo,
    hint: inquiryOk ? null : `还差 ${(inquiryMissing || []).length} 个平台 · 0 个也要填 0`,
    minutes: 3, to: '/admin/worklog',
  })

  t.push({
    key: 'adds', label: '加微信人数',
    state: log?.wechat_adds != null ? S.done : S.todo,
    minutes: 1, to: '/admin/worklog',
  })

  // 今天要发 —— 没有待发的不是她的错，是内容还没准备好
  const ready = (slotsToday || []).filter(s => s.status === 'ready')
  const posted = (slotsToday || []).filter(s => s.posted_at)
  // ⚠️ 2026-10-18 对调：制作归客服、发布归经理。
  //    理由是小红书显示 IP 属地 —— 小洁的 VPN 在香港，发帖显示「香港」
  //    对一个悉尼搬家公司很违和；Annie 的网络是本地的。
  //    制作不看 IP，所以小洁写、Annie 发。
  if (!isManager) {
    t.push({
      key: 'edit', label: '编辑内容',
      state: (editedToday || 0) > 0 ? S.done : S.todo,
      hint: (editedToday || 0) > 0 ? `今天改了 ${editedToday} 条` : '本周的格子还空着',
      minutes: 45, to: '/admin/content',
    })
  }
  // 老板 10-15：「感觉还少内容啊，需要发布的小红书」——
  // 原来只写「还有 N 条没发」，她得点进去才知道发哪个号。把账号名带出来。
  const who = nameOfAccount
    ? [...new Set(ready.map(s => nameOfAccount(s.account_id)))].join(' · ')
    : ''
  // 发布只给经理（她的网络环境适合发）。
  // 客服看不到这条 —— 她的活是把内容做出来，做完交给经理发。
  if (isManager) {
    t.push({
      key: 'post',
      label: ready.length ? `发布 ${who || '今天排的内容'}` : '发布今天排的内容',
      state: ready.length === 0 ? (posted.length ? S.done : S.wait) : S.todo,
      hint: ready.length ? `${ready.length} 条待发`
        : posted.length ? `今天发了 ${posted.length} 条`
        : '等小洁把内容做好 —— 不是你的事',
      minutes: ready.length * 5, to: '/admin/content-today',
    })
  }

  // 小红书评论配额只给客服 —— 经理的主动开发是 to B，不按天算
  if (!isManager) {
    const n = log?.comment_count ?? 0
    const shots = log?.comment_shots?.length || 0
    t.push({
      key: 'comment', label: `小红书评论 ${n}/${quota} 条`,
      state: n >= quota && shots > 0 ? S.done : S.todo,
      hint: n < quota ? `还差 ${quota - n} 条` : shots ? null : '填了条数但还没传截图',
      minutes: Math.max(0, quota - n) * 4, to: '/admin/worklog',
    })
  } else {
    t.push({
      key: 'b2b', label: '企业开发（选填）',
      state: String(log?.b2b_outreach || '').trim() ? S.done : S.skip,
      hint: '长线工作，不按天算 —— 今天没进展就空着',
      minutes: 0, to: '/admin/worklog',
    })
  }

  t.push({
    key: 'issues', label: '问题 · 想改进的地方',
    state: String(log?.issues || '').trim() ? S.done : S.todo,
    hint: '每天至少一条，内容不限',
    minutes: 2, to: '/admin/worklog',
  })

  t.push({
    key: 'submit', label: '提交日报',
    state: log?.submitted_at ? S.done
      : t.some(x => x.state === S.todo) ? S.wait : S.todo,
    hint: log?.submitted_at ? null : '上面做完才能交',
    minutes: 1, to: '/admin/worklog',
  })

  return t
}

/** 周任务单独一行 —— 混进日清单会天天显示红的，然后被无视 */
export function weekTasks(ctx) {
  const { role, weekVideo, weekOut } = ctx
  const isManager = role === 'admin' || role === 'manager'
  const out = []
  if (isManager && weekOut) {
    out.push({ key: 'wtext', label: `本周文案 ${weekOut.text.done}/${weekOut.text.total} 条`,
      ok: weekOut.text.done >= weekOut.text.total })
    out.push({ key: 'wvideo', label: `本周视频 ${weekOut.video.done}/${weekOut.video.total} 条`,
      ok: weekOut.video.done >= weekOut.video.total })
  } else if (weekVideo) {
    out.push({ key: 'wvideo', label: `本周视频 ${weekVideo.video}/1 条`, ok: weekVideo.ok })
  }
  return out
}

export function progressOf(tasks) {
  const counted = tasks.filter(t => t.state !== S.skip)
  const done = counted.filter(t => t.state === S.done).length
  const left = counted.filter(t => t.state === S.todo)
  return {
    done, total: counted.length,
    minutesLeft: left.reduce((s, t) => s + (t.minutes || 0), 0),
    allDone: done === counted.length,
  }
}
