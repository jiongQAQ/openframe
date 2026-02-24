import { ipcMain } from 'electron'
import { getRawDb } from '../db'

type CharacterRow = {
  id: string
  project_id: string
  name: string
  gender: string
  age: string
  personality: string
  thumbnail: string | null
  appearance: string
  background: string
  created_at: number
}

function ensureCharactersSchema() {
  const raw = getRawDb()
  raw.exec(
    'CREATE TABLE IF NOT EXISTS characters (id text PRIMARY KEY NOT NULL, project_id text NOT NULL, name text NOT NULL DEFAULT \'\', gender text NOT NULL DEFAULT \'\', age text NOT NULL DEFAULT \'\', personality text NOT NULL DEFAULT \'\', appearance text NOT NULL DEFAULT \'\', background text NOT NULL DEFAULT \'\', created_at integer NOT NULL)',
  )
  try {
    raw.exec('ALTER TABLE characters ADD COLUMN thumbnail text')
  } catch {
    // ignore when column already exists
  }
}

export function registerCharactersHandlers() {
  ensureCharactersSchema()

  ipcMain.handle('characters:getAll', () => {
    const raw = getRawDb()
    return raw
      .prepare(
        'SELECT id, project_id, name, gender, age, personality, thumbnail, appearance, background, created_at FROM characters ORDER BY created_at DESC',
      )
      .all() as CharacterRow[]
  })

  ipcMain.handle('characters:getByProject', (_event, projectId: string) => {
    const raw = getRawDb()
    return raw
      .prepare(
        'SELECT id, project_id, name, gender, age, personality, thumbnail, appearance, background, created_at FROM characters WHERE project_id = ? ORDER BY created_at ASC',
      )
      .all(projectId) as CharacterRow[]
  })

  ipcMain.handle('characters:insert', (_event, character: CharacterRow) => {
    const raw = getRawDb()
    raw
      .prepare(
        'INSERT OR REPLACE INTO characters (id, project_id, name, gender, age, personality, thumbnail, appearance, background, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        character.id,
        character.project_id,
        character.name,
        character.gender,
        character.age,
        character.personality,
        character.thumbnail,
        character.appearance,
        character.background,
        character.created_at,
      )
  })

  ipcMain.handle('characters:update', (_event, character: CharacterRow) => {
    const raw = getRawDb()
    raw
      .prepare(
        'UPDATE characters SET name = ?, gender = ?, age = ?, personality = ?, thumbnail = ?, appearance = ?, background = ? WHERE id = ?',
      )
      .run(
        character.name,
        character.gender,
        character.age,
        character.personality,
        character.thumbnail,
        character.appearance,
        character.background,
        character.id,
      )
  })

  ipcMain.handle('characters:replaceByProject', (_event, payload: { projectId: string; characters: CharacterRow[] }) => {
    const raw = getRawDb()
    raw.prepare('DELETE FROM characters WHERE project_id = ?').run(payload.projectId)
    const insertStmt = raw.prepare(
      'INSERT INTO characters (id, project_id, name, gender, age, personality, thumbnail, appearance, background, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    for (const character of payload.characters) {
      insertStmt.run(
        character.id,
        payload.projectId,
        character.name,
        character.gender,
        character.age,
        character.personality,
        character.thumbnail,
        character.appearance,
        character.background,
        character.created_at,
      )
    }
  })

  ipcMain.handle('characters:delete', (_event, id: string) => {
    const raw = getRawDb()
    raw.prepare('DELETE FROM characters WHERE id = ?').run(id)
  })
}
