import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { BrowserWindow, app, dialog, ipcMain, shell, type OpenDialogOptions } from 'electron'
import { getDataDir } from '../data_dir'

type AutoEditClip = {
  shotId: string
  path: string
  title?: string
  trimStartSec?: number
  trimEndSec?: number
}

type AutoEditPayload = {
  ratio: '16:9' | '9:16'
  orderedShotIds: string[]
  clips: AutoEditClip[]
}

type AutoEditResult = {
  outputPath: string
}

type ExportMergedVideoPayload = AutoEditPayload

type ExportMergedVideoResult = {
  outputPath?: string
  canceled?: boolean
}

type ExportFcpxmlPayload = {
  ratio: '16:9' | '9:16'
  orderedShotIds: string[]
  clips: AutoEditClip[]
  projectName?: string
}

type ExportFcpxmlResult = {
  outputPath: string
}

type ExportEdlPayload = {
  orderedShotIds: string[]
  clips: AutoEditClip[]
  projectName?: string
  fps?: number
}

type ExportEdlResult = {
  outputPath: string
}

type ExportTimelineIpcResult =
  | { outputPath: string }
  | { canceled: true }

function isSubPath(targetPath: string, parentPath: string): boolean {
  const resolvedTarget = path.resolve(targetPath)
  const resolvedParent = path.resolve(parentPath) + path.sep
  return resolvedTarget.startsWith(resolvedParent)
}

function ratioFilter(ratio: '16:9' | '9:16'): string {
  if (ratio === '9:16') {
    return 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black'
  }
  return 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black'
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    proc.on('error', (error) => {
      reject(error)
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      const tail = stderr.split('\n').slice(-10).join('\n').trim()
      reject(new Error(tail || `ffmpeg exited with code ${String(code)}`))
    })
  })
}

function escapeXml(value: string): string {
  return value
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;')
    .split("'").join('&apos;')
}

function secToFcpxTime(seconds: number, fps = 30): string {
  const frames = Math.max(1, Math.round(seconds * fps))
  return `${String(frames)}/${String(fps)}s`
}

function formatResourceByRatio(ratio: '16:9' | '9:16'): { width: number; height: number; formatName: string } {
  if (ratio === '9:16') {
    return {
      width: 1080,
      height: 1920,
      formatName: 'FFVideoFormatVertical1080x1920p30',
    }
  }
  return {
    width: 1920,
    height: 1080,
    formatName: 'FFVideoFormat1080p30',
  }
}

function sanitizeReelName(value: string): string {
  const normalized = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  if (!normalized) return 'OPENFRM'
  return normalized.slice(0, 8)
}

function framesToTimecode(totalFrames: number, fps: number): string {
  const safeFrames = Math.max(0, Math.floor(totalFrames))
  const frames = safeFrames % fps
  const totalSeconds = Math.floor(safeFrames / fps)
  const seconds = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60
  const hours = Math.floor(totalMinutes / 60)

  const pad2 = (value: number) => String(value).padStart(2, '0')
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}:${pad2(frames)}`
}

async function exportEdl(payload: ExportEdlPayload, outputDir?: string): Promise<ExportEdlResult> {
  const videosDir = path.resolve(path.join(getDataDir(), 'videos'))
  const exportsDir = outputDir
    ? path.resolve(outputDir)
    : path.join(videosDir, 'exports')
  await fs.mkdir(exportsDir, { recursive: true })

  const clipByShotId = new Map(payload.clips.map((clip) => [clip.shotId, clip]))
  const orderedClips = payload.orderedShotIds
    .map((shotId) => clipByShotId.get(shotId))
    .filter(Boolean) as AutoEditClip[]
  const selectedClips = orderedClips.length > 0 ? orderedClips : payload.clips

  if (selectedClips.length === 0) {
    throw new Error('No clips available for EDL export')
  }

  for (const clip of selectedClips) {
    if (!isSubPath(clip.path, videosDir)) {
      throw new Error('Clip path is outside videos directory')
    }
    await fs.access(clip.path)
  }

  const fps = Math.max(1, Math.floor(payload.fps ?? 30))
  const projectName = (payload.projectName || 'OpenFrame Export').trim() || 'OpenFrame Export'
  const title = sanitizeReelName(projectName)

  let recordStartFrames = 0
  const lines: string[] = [
    `TITLE: ${title}`,
    'FCM: NON-DROP FRAME',
    '',
  ]

  selectedClips.forEach((clip, index) => {
    const trimStartSec = Math.max(0, clip.trimStartSec ?? 0)
    const trimEndRaw = clip.trimEndSec ?? trimStartSec + 3
    const durationSec = Math.max(0.1, trimEndRaw - trimStartSec)

    const sourceInFrames = Math.round(trimStartSec * fps)
    const sourceOutFrames = sourceInFrames + Math.max(1, Math.round(durationSec * fps))
    const recordInFrames = recordStartFrames
    const recordOutFrames = recordInFrames + (sourceOutFrames - sourceInFrames)
    recordStartFrames = recordOutFrames

    const eventNo = String(index + 1).padStart(3, '0')
    const reelName = sanitizeReelName(clip.title || path.basename(clip.path, path.extname(clip.path)) || `SHOT${eventNo}`)

    lines.push(
      `${eventNo}  ${reelName} V     C        ${framesToTimecode(sourceInFrames, fps)} ${framesToTimecode(sourceOutFrames, fps)} ${framesToTimecode(recordInFrames, fps)} ${framesToTimecode(recordOutFrames, fps)}`,
      `* FROM CLIP NAME: ${(clip.title || path.basename(clip.path)).trim() || `Shot ${eventNo}`}`,
      `* SOURCE FILE: ${clip.path}`,
      '',
    )
  })

  const runId = Date.now().toString(36)
  const outputPath = path.join(exportsDir, `timeline_${runId}.edl`)
  await fs.writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8')
  return { outputPath }
}

async function exportFcpxml(payload: ExportFcpxmlPayload, outputDir?: string): Promise<ExportFcpxmlResult> {
  const videosDir = path.resolve(path.join(getDataDir(), 'videos'))
  const exportsDir = outputDir
    ? path.resolve(outputDir)
    : path.join(videosDir, 'exports')
  await fs.mkdir(exportsDir, { recursive: true })

  const clipByShotId = new Map(payload.clips.map((clip) => [clip.shotId, clip]))
  const orderedClips = payload.orderedShotIds
    .map((shotId) => clipByShotId.get(shotId))
    .filter(Boolean) as AutoEditClip[]

  const selectedClips = orderedClips.length > 0 ? orderedClips : payload.clips

  if (selectedClips.length === 0) {
    throw new Error('No clips available for FCPXML export')
  }

  for (const clip of selectedClips) {
    if (!isSubPath(clip.path, videosDir)) {
      throw new Error('Clip path is outside videos directory')
    }
    await fs.access(clip.path)
  }

  const fps = 30
  const format = formatResourceByRatio(payload.ratio)
  const runId = Date.now().toString(36)
  const projectName = (payload.projectName || 'OpenFrame Export').trim() || 'OpenFrame Export'

  const assets = selectedClips.map((clip, index) => {
    const trimStartSec = Math.max(0, clip.trimStartSec ?? 0)
    const trimEndRaw = clip.trimEndSec ?? trimStartSec + 3
    const trimDurationSec = Math.max(0.1, trimEndRaw - trimStartSec)
    return {
      id: `r_asset_${String(index + 1)}`,
      name: (clip.title || path.basename(clip.path, path.extname(clip.path)) || `Shot ${String(index + 1)}`).trim() || `Shot ${String(index + 1)}`,
      uid: escapeXml(clip.path),
      mediaSrc: pathToFileURL(clip.path).toString(),
      startSec: trimStartSec,
      durationSec: trimDurationSec,
    }
  })

  let timelineOffsetSec = 0
  const spineClips = assets.map((asset) => {
    const clip = {
      ...asset,
      offsetSec: timelineOffsetSec,
    }
    timelineOffsetSec += asset.durationSec
    return clip
  })

  const totalDurationSec = Math.max(0.1, spineClips.reduce((sum, clip) => sum + clip.durationSec, 0))

  const fcpxml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE fcpxml>',
    '<fcpxml version="1.11">',
    '  <resources>',
    `    <format id="r_format" name="${escapeXml(format.formatName)}" frameDuration="1/${String(fps)}s" width="${String(format.width)}" height="${String(format.height)}" colorSpace="1-1-1 (Rec. 709)"/>`,
    ...assets.flatMap((asset) => [
      `    <asset id="${asset.id}" name="${escapeXml(asset.name)}" uid="${asset.uid}" start="${secToFcpxTime(asset.startSec, fps)}" duration="${secToFcpxTime(asset.durationSec, fps)}" hasVideo="1" hasAudio="0" format="r_format">`,
      `      <media-rep kind="original-media" src="${escapeXml(asset.mediaSrc)}"/>`,
      '    </asset>',
    ]),
    '  </resources>',
    '  <library>',
    `    <event name="${escapeXml(projectName)}">`,
    `      <project name="${escapeXml(`${projectName} Timeline`)}">`,
    `        <sequence format="r_format" duration="${secToFcpxTime(totalDurationSec, fps)}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">`,
    '          <spine>',
    ...spineClips.map((clip) => `            <asset-clip name="${escapeXml(clip.name)}" ref="${clip.id}" offset="${secToFcpxTime(clip.offsetSec, fps)}" start="${secToFcpxTime(clip.startSec, fps)}" duration="${secToFcpxTime(clip.durationSec, fps)}"/>`),
    '          </spine>',
    '        </sequence>',
    '      </project>',
    '    </event>',
    '  </library>',
    '</fcpxml>',
  ].join('\n')

  const outputPath = path.join(exportsDir, `timeline_${runId}.fcpxml`)
  await fs.writeFile(outputPath, fcpxml, 'utf8')
  return { outputPath }
}

async function autoEditWithFfmpeg(
  payload: AutoEditPayload,
  options?: { outputPath?: string },
): Promise<AutoEditResult> {
  const videosDir = path.resolve(path.join(getDataDir(), 'videos'))
  const editsDir = path.join(videosDir, 'edits')
  await fs.mkdir(editsDir, { recursive: true })

  const clipByShotId = new Map(payload.clips.map((clip) => [clip.shotId, clip]))
  const orderedClips = payload.orderedShotIds
    .map((shotId) => clipByShotId.get(shotId))
    .filter(Boolean) as AutoEditClip[]

  const selectedClips = orderedClips.length > 0
    ? orderedClips
    : payload.clips

  if (selectedClips.length === 0) {
    throw new Error('No clips available for auto edit')
  }

  for (const clip of selectedClips) {
    if (!isSubPath(clip.path, videosDir)) {
      throw new Error('Clip path is outside videos directory')
    }
    await fs.access(clip.path)
  }

  const runId = Date.now().toString(36)
  const workDir = path.join(editsDir, runId)
  await fs.mkdir(workDir, { recursive: true })

  const normalizedPaths: string[] = []
  for (const [index, clip] of selectedClips.entries()) {
    const normalizedPath = path.join(workDir, `clip_${String(index + 1).padStart(3, '0')}.mp4`)

    const inputArgs: string[] = ['-y']

    if (clip.trimStartSec != null && clip.trimStartSec > 0) {
      inputArgs.push('-ss', String(clip.trimStartSec))
    }

    inputArgs.push('-i', clip.path)

    if (clip.trimStartSec != null && clip.trimEndSec != null) {
      const duration = clip.trimEndSec - clip.trimStartSec
      if (duration > 0) {
        inputArgs.push('-t', String(duration))
      }
    }

    inputArgs.push(
      '-vf',
      ratioFilter(payload.ratio),
      '-r',
      '30',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-ar',
      '48000',
      '-ac',
      '2',
      '-b:a',
      '192k',
      normalizedPath,
    )

    await runFfmpeg(inputArgs)
    normalizedPaths.push(normalizedPath)
  }

  const concatListPath = path.join(workDir, 'concat.txt')
  const concatBody = normalizedPaths
    .map((videoPath) => `file '${videoPath.split("'").join("'\\''")}'`)
    .join('\n')
  await fs.writeFile(concatListPath, `${concatBody}\n`, 'utf8')

  const outputPath = options?.outputPath
    ? path.resolve(options.outputPath)
    : path.join(editsDir, `auto_edit_${runId}.mp4`)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await runFfmpeg([
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    concatListPath,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '22',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-b:a',
    '192k',
    '-movflags',
    '+faststart',
    outputPath,
  ])

  return { outputPath }
}

export function registerMediaHandlers() {
  ipcMain.handle('media:autoEdit', async (_event, payload: AutoEditPayload) => {
    try {
      return await autoEditWithFfmpeg(payload)
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        throw new Error('ffmpeg not found. Please install ffmpeg and restart OpenFrame.')
      }
      throw error
    }
  })

  ipcMain.handle('media:exportMergedVideo', async (_event, payload: ExportMergedVideoPayload) => {
    const defaultExportDir = app.getPath('downloads')
    await fs.mkdir(defaultExportDir, { recursive: true })

    const focusedWindow = BrowserWindow.getFocusedWindow()
    const options: OpenDialogOptions = {
      title: 'Select export folder',
      defaultPath: defaultExportDir,
      properties: ['openDirectory', 'createDirectory'],
    }
    const folderPick = focusedWindow
      ? await dialog.showOpenDialog(focusedWindow, options)
      : await dialog.showOpenDialog(options)

    if (folderPick.canceled || folderPick.filePaths.length === 0) {
      return { canceled: true } as ExportMergedVideoResult
    }

    const targetFolder = folderPick.filePaths[0]
    const runId = Date.now().toString(36)
    const outputPath = path.join(targetFolder, `openframe_merged_${runId}.mp4`)

    const result = await autoEditWithFfmpeg(payload, { outputPath })
    await shell.openPath(path.dirname(result.outputPath))
    return { outputPath: result.outputPath } as ExportMergedVideoResult
  })

  ipcMain.handle('media:exportFcpxml', async (_event, payload: ExportFcpxmlPayload) => {
    const defaultExportDir = app.getPath('downloads')
    await fs.mkdir(defaultExportDir, { recursive: true })
    const focusedWindow = BrowserWindow.getFocusedWindow()
    const options: OpenDialogOptions = {
      title: 'Select export folder',
      defaultPath: defaultExportDir,
      properties: ['openDirectory', 'createDirectory'],
    }
    const folderPick = focusedWindow
      ? await dialog.showOpenDialog(focusedWindow, options)
      : await dialog.showOpenDialog(options)
    if (folderPick.canceled || folderPick.filePaths.length === 0) {
      return { canceled: true } as ExportTimelineIpcResult
    }

    const result = await exportFcpxml(payload, folderPick.filePaths[0])
    await shell.openPath(path.dirname(result.outputPath))
    return result as ExportTimelineIpcResult
  })

  ipcMain.handle('media:exportEdl', async (_event, payload: ExportEdlPayload) => {
    const defaultExportDir = app.getPath('downloads')
    await fs.mkdir(defaultExportDir, { recursive: true })
    const focusedWindow = BrowserWindow.getFocusedWindow()
    const options: OpenDialogOptions = {
      title: 'Select export folder',
      defaultPath: defaultExportDir,
      properties: ['openDirectory', 'createDirectory'],
    }
    const folderPick = focusedWindow
      ? await dialog.showOpenDialog(focusedWindow, options)
      : await dialog.showOpenDialog(options)
    if (folderPick.canceled || folderPick.filePaths.length === 0) {
      return { canceled: true } as ExportTimelineIpcResult
    }

    const result = await exportEdl(payload, folderPick.filePaths[0])
    await shell.openPath(path.dirname(result.outputPath))
    return result as ExportTimelineIpcResult
  })
}
