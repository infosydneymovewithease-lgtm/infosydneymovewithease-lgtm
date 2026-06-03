// iPhone defaults to HEIC, which browsers can't render → broken images in admin.
// Detect HEIC on the client and transcode to JPEG before upload so the same
// public URL renders directly in <img>.
import heic2any from 'heic2any'

function isHeic(file) {
  const type = (file.type || '').toLowerCase()
  if (type === 'image/heic' || type === 'image/heif') return true
  const name = (file.name || '').toLowerCase()
  return name.endsWith('.heic') || name.endsWith('.heif')
}

export async function normalizeImageFile(file) {
  if (!isHeic(file)) return file
  const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 })
  const out = Array.isArray(blob) ? blob[0] : blob
  const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg')
  return new File([out], newName, { type: 'image/jpeg' })
}
