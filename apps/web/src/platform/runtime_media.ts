import type { ObjectStorageConfig } from '@openframe/shared/object-storage-config'
import { createObjectStorageFactory } from '@openframe/shared/object-storage-factory'
import {
  type ExportMergedVideoPayload,
  pickExportClips,
} from './runtime_timeline'

let mergedVideoPreviewUrl: string | null = null
const VERCEL_FUNCTION_SAFE_PAYLOAD_BYTES = 4 * 1024 * 1024

class StoragePayloadTooLargeError extends Error {}

export function extToMimeType(ext: string, folder?: 'thumbnails' | 'videos'): string {
  const value = ext.replace(/^\./, '').toLowerCase()
  if (folder === 'videos') {
    if (value === 'webm') return 'video/webm'
    if (value === 'mov') return 'video/quicktime'
    if (value === 'm4v') return 'video/x-m4v'
    return 'video/mp4'
  }
  if (value === 'jpg' || value === 'jpeg') return 'image/jpeg'
  if (value === 'webp') return 'image/webp'
  if (value === 'gif') return 'image/gif'
  if (value === 'bmp') return 'image/bmp'
  if (value === 'svg') return 'image/svg+xml'
  if (value === 'avif') return 'image/avif'
  return 'image/png'
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('Unable to read blob as data URL'))
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('Unable to read blob'))
    }
    reader.readAsDataURL(blob)
  })
}

export async function toDataUrl(bytes: Uint8Array, mimeType: string): Promise<string> {
  const normalized = new Uint8Array(bytes)
  const blob = new Blob([normalized], { type: mimeType })
  return blobToDataUrl(blob)
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

function estimateStorageApiPayloadBytes(dataSizeBytes: number): number {
  const base64Bytes = Math.ceil((dataSizeBytes * 4) / 3)
  const jsonOverhead = 16 * 1024
  return base64Bytes + jsonOverhead
}

function isPayloadTooLargeResponse(status: number, bodyText: string): boolean {
  if (status === 413) return true
  const normalized = bodyText.toLowerCase()
  return normalized.includes('request entity too large')
    || normalized.includes('function_payload_too_large')
    || normalized.includes('payload too large')
}

async function uploadMediaViaStorageApi(args: {
  data: Uint8Array
  ext: string
  folder?: 'thumbnails' | 'videos'
  config: ObjectStorageConfig
}): Promise<string> {
  const response = await fetch('/api/storage', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      config: args.config,
      ext: args.ext,
      folder: args.folder === 'videos' ? 'videos' : 'thumbnails',
      dataBase64: uint8ToBase64(args.data),
    }),
  })

  const rawText = await response.text()
  const payload = (() => {
    if (!rawText) return null
    try {
      return JSON.parse(rawText) as { ok?: boolean; url?: string; error?: string }
    } catch {
      return null
    }
  })()

  if (isPayloadTooLargeResponse(response.status, rawText)) {
    throw new StoragePayloadTooLargeError('Storage API payload too large')
  }

  if (!response.ok || payload?.ok !== true || !payload.url) {
    throw new Error(payload?.error || rawText || `Storage upload failed (${response.status})`)
  }

  return payload.url
}

async function uploadMediaDirectlyToObjectStorage(args: {
  data: Uint8Array
  ext: string
  folder?: 'thumbnails' | 'videos'
  config: ObjectStorageConfig
}): Promise<string> {
  const storage = createObjectStorageFactory(args.config)
  if (!storage.enabled) {
    throw new Error('Object storage is not configured')
  }
  const url = await storage.saveMedia({
    data: args.data,
    ext: args.ext,
    folder: args.folder,
  })
  if (!url) {
    throw new Error('Object storage is not configured')
  }
  return url
}

export async function uploadMediaToObjectStorage(args: {
  data: Uint8Array
  ext: string
  folder?: 'thumbnails' | 'videos'
  config: ObjectStorageConfig
}): Promise<string> {
  const estimatedPayloadBytes = estimateStorageApiPayloadBytes(args.data.byteLength)
  const shouldBypassStorageApi = estimatedPayloadBytes >= VERCEL_FUNCTION_SAFE_PAYLOAD_BYTES

  if (shouldBypassStorageApi) {
    try {
      return await uploadMediaDirectlyToObjectStorage(args)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(
        `Media payload exceeds Vercel Function limits. Direct object storage upload also failed: ${message}`,
      )
    }
  }

  try {
    return await uploadMediaViaStorageApi(args)
  } catch (err: unknown) {
    if (!(err instanceof StoragePayloadTooLargeError)) {
      throw err
    }
    try {
      return await uploadMediaDirectlyToObjectStorage(args)
    } catch (directErr: unknown) {
      const directMessage = directErr instanceof Error ? directErr.message : String(directErr)
      throw new Error(
        `Vercel Function payload too large and direct object storage upload failed: ${directMessage}`,
      )
    }
  }
}

export async function readMediaAsDataUrl(path: string): Promise<string | null> {
  if (!path) return null
  if (/^data:/i.test(path)) return path

  if (/^openframe-thumb:/i.test(path)) {
    try {
      const parsed = new URL(path)
      const rawPath = parsed.searchParams.get('path')
      if (!rawPath) return null
      return readMediaAsDataUrl(decodeURIComponent(rawPath))
    } catch {
      return null
    }
  }

  if (/^(https?:|blob:)/i.test(path)) {
    try {
      const response = await fetch(path)
      if (!response.ok) return null
      const blob = await response.blob()
      return blobToDataUrl(blob)
    } catch {
      return null
    }
  }

  return null
}

function triggerDownload(objectUrl: string, filename: string): void {
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.style.display = 'none'
  const container = document.body ?? document.documentElement
  container.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function pickMergeRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ]
  const matched = candidates.find((value) => MediaRecorder.isTypeSupported(value))
  return matched ?? ''
}

function formatResourceByRatio(
  ratio: '16:9' | '9:16',
): { width: number; height: number } {
  if (ratio === '9:16') {
    return {
      width: 1080,
      height: 1920,
    }
  }
  return {
    width: 1920,
    height: 1080,
  }
}

function nextAnimationFrame(): Promise<number> {
  return new Promise((resolve) => {
    window.requestAnimationFrame((timestamp) => resolve(timestamp))
  })
}

function drawVideoFrameContain(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  outputWidth: number,
  outputHeight: number,
): void {
  const sourceWidth = video.videoWidth || outputWidth
  const sourceHeight = video.videoHeight || outputHeight
  const scale = Math.min(outputWidth / sourceWidth, outputHeight / sourceHeight)
  const drawWidth = sourceWidth * scale
  const drawHeight = sourceHeight * scale
  const drawX = (outputWidth - drawWidth) / 2
  const drawY = (outputHeight - drawHeight) / 2

  context.fillStyle = '#000000'
  context.fillRect(0, 0, outputWidth, outputHeight)
  context.drawImage(video, drawX, drawY, drawWidth, drawHeight)
}

function loadVideoMetadata(video: HTMLVideoElement, src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('error', onError)
    }
    const onLoaded = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('Failed to load source clip for merged export'))
    }

    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('error', onError)
    video.src = src
    video.load()
  })
}

function seekVideo(video: HTMLVideoElement, nextTimeSec: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const target = Math.max(0, nextTimeSec)
    if (Math.abs(video.currentTime - target) < 0.02) {
      resolve()
      return
    }

    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
    }
    const onSeeked = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('Failed to seek source clip for merged export'))
    }

    video.addEventListener('seeked', onSeeked)
    video.addEventListener('error', onError)
    video.currentTime = target
  })
}

function stopMediaStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => {
    track.stop()
  })
}

async function resolveClipSourceForMerge(path: string): Promise<string> {
  if (!path) return ''
  if (/^(data:|blob:)/i.test(path)) return path
  if (/^(openframe-thumb:|https?:)/i.test(path)) {
    return (await readMediaAsDataUrl(path)) || path
  }
  return path
}

async function renderClipRangeToCanvas(args: {
  video: HTMLVideoElement
  context: CanvasRenderingContext2D
  outputWidth: number
  outputHeight: number
  trimStartSec: number
  trimEndSec: number
  fps: number
}): Promise<void> {
  const { video, context, outputWidth, outputHeight, trimStartSec, trimEndSec, fps } = args
  const minDuration = 1 / fps
  const safeEndSec = Math.max(trimStartSec + minDuration, trimEndSec)

  await seekVideo(video, trimStartSec)
  drawVideoFrameContain(context, video, outputWidth, outputHeight)

  try {
    await video.play()
  } catch {
    throw new Error('Browser blocked clip playback during merged export')
  }

  const endThreshold = 1 / fps
  while (video.currentTime < safeEndSec - endThreshold && !video.ended) {
    drawVideoFrameContain(context, video, outputWidth, outputHeight)
    await nextAnimationFrame()
  }

  video.pause()
  await seekVideo(video, safeEndSec)
  drawVideoFrameContain(context, video, outputWidth, outputHeight)
}

export async function exportMergedVideoInBrowser(payload: ExportMergedVideoPayload): Promise<{ outputPath: string }> {
  const selectedClips = pickExportClips(payload)
  if (selectedClips.length === 0) {
    throw new Error('No clips available for merged video export')
  }
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder is unavailable in this browser')
  }

  const mimeType = pickMergeRecorderMimeType()
  const fps = 30
  const { width, height } = formatResourceByRatio(payload.ratio)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Unable to initialize canvas for merged export')
  }

  const stream = canvas.captureStream(fps)
  const recorder = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream)
  const chunks: BlobPart[] = []
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'

  const blobPromise = new Promise<Blob>((resolve, reject) => {
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data)
    })
    recorder.addEventListener('stop', () => {
      if (chunks.length === 0) {
        reject(new Error('Merged export produced empty output'))
        return
      }
      const firstChunk = chunks[0]
      const fallbackType = firstChunk instanceof Blob ? firstChunk.type : 'video/webm'
      const outputType = mimeType || fallbackType || 'video/webm'
      resolve(new Blob(chunks, { type: outputType || 'video/webm' }))
    })
    recorder.addEventListener('error', () => {
      reject(new Error('MediaRecorder failed during merged export'))
    })
  })

  let recorderStarted = false
  let mergeError: Error | null = null

  try {
    recorder.start(250)
    recorderStarted = true
    for (const clip of selectedClips) {
      const source = await resolveClipSourceForMerge(clip.path)
      if (!source) {
        throw new Error('Source clip is missing or unsupported')
      }
      await loadVideoMetadata(video, source)

      const trimStartSec = Math.max(0, clip.trimStartSec ?? 0)
      const trimEndRaw = clip.trimEndSec ?? trimStartSec + 3
      const clipDuration = Number.isFinite(video.duration) && video.duration > 0
        ? video.duration
        : trimEndRaw
      const trimEndSec = Math.max(
        trimStartSec + 0.1,
        Math.min(trimEndRaw, clipDuration),
      )

      await renderClipRangeToCanvas({
        video,
        context,
        outputWidth: width,
        outputHeight: height,
        trimStartSec,
        trimEndSec,
        fps,
      })
    }
  } catch (error) {
    mergeError = error instanceof Error ? error : new Error(String(error))
  } finally {
    video.pause()
    video.removeAttribute('src')
    video.load()
    if (recorderStarted && recorder.state !== 'inactive') {
      recorder.stop()
    }
  }

  try {
    if (!recorderStarted) {
      throw mergeError ?? new Error('Merged export failed before recording started')
    }

    const blob = await blobPromise
    if (mergeError) {
      throw mergeError
    }

    if (mergedVideoPreviewUrl) {
      URL.revokeObjectURL(mergedVideoPreviewUrl)
    }
    mergedVideoPreviewUrl = URL.createObjectURL(blob)

    const runId = Date.now().toString(36)
    triggerDownload(mergedVideoPreviewUrl, `merged_${runId}.webm`)
    return { outputPath: mergedVideoPreviewUrl }
  } finally {
    stopMediaStream(stream)
  }
}
