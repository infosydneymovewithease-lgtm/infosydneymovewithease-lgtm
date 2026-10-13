// 图片上传 —— 从 NewOrder.jsx 抽出来共用（2026-10-13）
//
// 原来只有建单页用，现在主动开发的评论截图也要用。
// 行为保持一致：先传 Supabase Storage，失败就退回 base64 存在记录里 ——
// 宁可图片大一点存在数据库里，也不要让客服白填一遍。

import { supabase } from '../lib/supabase'

/** 压缩到长边 1600px 以内，避免手机原图几 MB 一张 */
async function normalize(file) {
  if (!file.type?.startsWith('image/')) return file
  try {
    const bmp = await createImageBitmap(file)
    const max = 1600
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
    if (scale === 1 && file.size < 1.5e6) return file
    const cv = document.createElement('canvas')
    cv.width = Math.round(bmp.width * scale)
    cv.height = Math.round(bmp.height * scale)
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height)
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.82))
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : file
  } catch {
    return file
  }
}

export async function uploadImage(rawFile, bucket = 'deposit-screenshots') {
  const file = await normalize(rawFile)
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Date.now()}.${ext}`
  const { data: stored, error } = await supabase.storage
    .from(bucket).upload(path, file, { contentType: file.type, upsert: false })
  if (!error) {
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(stored.path)
    return { name: file.name, url: publicUrl }
  }
  console.warn('[upload] storage 失败，退回 base64：', error.message)
  return new Promise(resolve => {
    const r = new FileReader()
    r.onload = e => resolve({ name: file.name, data: e.target.result })
    r.readAsDataURL(file)
  })
}
