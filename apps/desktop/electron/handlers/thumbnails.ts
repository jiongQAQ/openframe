import { ipcMain } from 'electron'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const THUMBNAILS_DIR = path.join(os.homedir(), '.openframe', 'thumbnails')

export function registerThumbnailsHandlers() {
  ipcMain.handle('thumbnails:save', (_event, data: Uint8Array, ext: string) => {
    fs.mkdirSync(THUMBNAILS_DIR, { recursive: true })
    const filename = `${randomUUID()}.${ext}`
    const filepath = path.join(THUMBNAILS_DIR, filename)
    fs.writeFileSync(filepath, Buffer.from(data))
    return filepath
  })

  ipcMain.handle('thumbnails:delete', (_event, filepath: string) => {
    try {
      if (filepath && filepath.startsWith(THUMBNAILS_DIR)) {
        fs.unlinkSync(filepath)
      }
    } catch {
      // 文件不存在时静默处理
    }
  })
}
