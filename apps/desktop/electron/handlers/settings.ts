import { ipcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const SETTINGS_PATH = path.join(os.homedir(), '.openframe', 'settings.json')

function readAll(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8')) as Record<string, string>
  } catch {
    return {}
  }
}

function writeAll(data: Record<string, string>) {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true })
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

export function registerSettingsHandlers() {
  ipcMain.handle('settings:getAll', (): Array<{ key: string; value: string }> => {
    const data = readAll()
    return Object.entries(data).map(([key, value]) => ({ key, value }))
  })

  ipcMain.handle('settings:upsert', (_event, key: string, value: string) => {
    const data = readAll()
    data[key] = value
    writeAll(data)
  })

  ipcMain.handle('settings:delete', (_event, key: string) => {
    const data = readAll()
    delete data[key]
    writeAll(data)
  })
}
