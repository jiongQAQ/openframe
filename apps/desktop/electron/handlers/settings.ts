import { ipcMain } from 'electron'
import Store from 'electron-store'

const store = new Store<Record<string, string>>({ name: 'settings' })

export function registerSettingsHandlers() {
  ipcMain.handle('settings:getAll', (): Array<{ key: string; value: string }> =>
    Object.entries(store.store).map(([key, value]) => ({ key, value })),
  )

  ipcMain.handle('settings:upsert', (_event, key: string, value: string) => {
    store.set(key, value)
  })

  ipcMain.handle('settings:delete', (_event, key: string) => {
    store.delete(key)
  })
}
