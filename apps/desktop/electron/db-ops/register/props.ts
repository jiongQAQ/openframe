import { ipcMain } from 'electron'
import {
  deleteProp,
  ensurePropsSchema,
  getAllProps,
  getPropsByProject,
  insertProp,
  replacePropsByProject,
  type PropRow,
  updateProp,
} from '../props'

export function registerPropsHandlers() {
  ensurePropsSchema()

  ipcMain.handle('props:getAll', () => getAllProps())
  ipcMain.handle('props:getByProject', (_event, projectId: string) => getPropsByProject(projectId))
  ipcMain.handle('props:insert', (_event, prop: PropRow) => insertProp(prop))
  ipcMain.handle('props:update', (_event, prop: PropRow) => updateProp(prop))
  ipcMain.handle('props:replaceByProject', (_event, payload: { projectId: string; props: PropRow[] }) => replacePropsByProject(payload))
  ipcMain.handle('props:delete', (_event, id: string) => deleteProp(id))
}
