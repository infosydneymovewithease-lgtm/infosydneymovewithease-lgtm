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
    openDays, editedToday, nameOfAccount, todayDone,
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
  //
  // ⚠️ 2026-10-22 拆成两条。老板：「经理这个进度应该有每日对账」
  //    原来一条「核对昨天的账和客服日报」把两件事捆在一起，
  //    而且只链到团队今日 —— 每日对账那一页在进度里【根本没有入口】。
  //    两件事发生在两个页面、做法也不一样：
  //      审核日报 → 团队今日（看她们填的对不对，不对就退回）
  //      日结对账 → 每日对账（逐单核金额，全部核完确认当日收入）
  if (isManager) {
    const open = openDays || []
    // ⚠️ 这两条查的是【昨天及以前】，不含今天 —— T+1 流程：
    //    「师傅当天没发，第二天上午打电话要到数据，再填对账」。
    //    所以文案里必须写明是哪一天，否则绿勾会被当成「今天的也核完了」。
    const md = d => String(d.work_date).slice(5).replace('-', '/')
    const needReview = open.filter(d => !d.team_confirmed)
    t.push({
      key: 'review', label: '审核客服日报',
      state: needReview.length === 0 ? S.done : S.todo,
      hint: needReview.length === 0
        ? '昨天及以前都审完了'
        : `${needReview.map(md).join('、')} 没审`,
      minutes: needReview.length * 8, to: '/admin/team-today',
    })

    const needClose = open.filter(d => !d.day_closed)
    // ⚠️ 老板 10-22：「这个不是应该提醒今天经理要做这件事情吗」
    //    日结是 T+1（今天结昨天的），但【今天已完成的单现在就能核】——
    //    攒到明天只会变成一堆。所以昨天的结清了，也要把今天能干的说出来。
    const n = Number(todayDone) || 0
    t.push({
      key: 'reconcile', label: '每日对账 · 日结',
      state: needClose.length === 0 ? S.done : S.todo,
      hint: needClose.length
        ? `${needClose.map(md).join('、')} 的账没结`
        : n
          ? `昨天及以前都结了 · 今天 ${n} 单已完成，现在就能核`
          : '昨天及以前的账都结了 · 今天还没有完成的单',
      minutes: needClose.length * 15,
      // 带上日期：直接落到最早那个没结的日子
      to: needClose.length
        ? `/admin/reconcile?date=${[...needClose].sort((a, b) =>
            String(a.work_date).localeCompare(String(b.work_date)))[0].work_date}`
        : '/admin/reconcile',
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
  // ⚠️ slotsToday 由调用方按【账号归属】过滤过，所以这里不用再判断谁能发哪个号。
  const ready = (slotsToday || []).filter(s => s.status === 'ready')
  const posted = (slotsToday || []).filter(s => s.posted_at)

  // ⚠️ 2026-10-21 分工重定：老板写，经理发。
  //    老板：「运营以后还是我和经理吧，我写她发，因为内容需要把控一些」
  //    （10-18 那版「小洁写、Annie 发」已作废；中间短暂由运营 Lili 全包，
  //      那个岗位 10-21 取消了。）
  //    写作只给老板 —— 挂在客服头上她会被催写她不再负责的东西。
  if (role === 'admin') {
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
  // ⚠️ 2026-10-21 老板：「小洁不需要发布的原因是小洁的 IP 地址是国内，
  //    我和经理是澳洲这面，另外朋友圈不受这个限制，小洁可以发布」
  //    所以小洁不是「不参与发布」，是【只发朋友圈】——
  //    小红书和视频号会公开显示 IP 属地，一个悉尼搬家公司显示国内城市很违和。
  //    谁能发哪个号由 channel_account.owner_staff_id 决定，调用方已经过滤好了；
  //    这里只要「手上有没有活」—— 没有归自己的号就不出这条任务。
  if (ready.length || posted.length || isManager) {
    t.push({
      key: 'post',
      label: ready.length ? `发布 ${who || '今天排的内容'}` : '发布今天排的内容',
      state: ready.length === 0 ? (posted.length ? S.done : S.wait) : S.todo,
      hint: ready.length ? `${ready.length} 条待发`
        : posted.length ? `今天发了 ${posted.length} 条`
        : '等内容做好 —— 不是你的事',
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
  const out = []
  // ⚠️ 2026-10-21：本周文案/视频是【制作】指标，归老板（他写）。
  //    经理和客服那边看「发了几条」，不看「做了几条」。
  if (role === 'admin' && weekOut) {
    out.push({ key: 'wtext', label: `本周文案 ${weekOut.text.done}/${weekOut.text.total} 条`,
      ok: weekOut.text.done >= weekOut.text.total })
    out.push({ key: 'wvideo', label: `本周视频 ${weekOut.video.done}/${weekOut.video.total} 条`,
      ok: weekOut.video.done >= weekOut.video.total })
  } else if (weekVideo) {
    // 经理看的是本周实际发出去几条视频
    out.push({ key: 'wvideo', label: `本周发了视频 ${weekVideo.video}/1 条`, ok: weekVideo.ok })
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
