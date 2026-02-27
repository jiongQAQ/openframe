import { ipcMain } from 'electron'
import {
  deleteCharacterRelation,
  ensureCharacterRelationsSchema,
  getAllCharacterRelations,
  getCharacterRelationsByProject,
  insertCharacterRelation,
  replaceCharacterRelationsByProject,
  type CharacterRelationRow,
  updateCharacterRelation,
} from '../character_relations'

export function registerCharacterRelationsHandlers() {
  ensureCharacterRelationsSchema()

  ipcMain.handle('characterRelations:getAll', () => getAllCharacterRelations())
  ipcMain.handle('characterRelations:getByProject', (_event, projectId: string) => getCharacterRelationsByProject(projectId))
  ipcMain.handle('characterRelations:insert', (_event, row: CharacterRelationRow) => insertCharacterRelation(row))
  ipcMain.handle('characterRelations:update', (_event, row: CharacterRelationRow) => updateCharacterRelation(row))
  ipcMain.handle('characterRelations:replaceByProject', (_event, payload: { projectId: string; relations: CharacterRelationRow[] }) => replaceCharacterRelationsByProject(payload))
  ipcMain.handle('characterRelations:delete', (_event, id: string) => deleteCharacterRelation(id))
}
