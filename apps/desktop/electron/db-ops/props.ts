import { getRawDb } from '../db'
import { runInTransaction } from './tx'

export type PropRow = {
  id: string
  project_id: string
  name: string
  category: string
  description: string
  thumbnail: string | null
  created_at: number
}

export function ensurePropsSchema(): void {
  const raw = getRawDb()
  raw.exec(
    "CREATE TABLE IF NOT EXISTS props (id text PRIMARY KEY NOT NULL, project_id text NOT NULL, name text NOT NULL DEFAULT '', category text NOT NULL DEFAULT '', description text NOT NULL DEFAULT '', thumbnail text, created_at integer NOT NULL)",
  )

  try {
    raw.exec('ALTER TABLE props ADD COLUMN thumbnail text')
  } catch {
    // ignore when column already exists
  }
}

export function getAllProps(): PropRow[] {
  const raw = getRawDb()
  return raw
    .prepare(
      'SELECT id, project_id, name, category, description, thumbnail, created_at FROM props ORDER BY created_at DESC',
    )
    .all() as PropRow[]
}

export function getPropsByProject(projectId: string): PropRow[] {
  const raw = getRawDb()
  return raw
    .prepare(
      'SELECT id, project_id, name, category, description, thumbnail, created_at FROM props WHERE project_id = ? ORDER BY created_at ASC',
    )
    .all(projectId) as PropRow[]
}

export function insertProp(prop: PropRow): void {
  const raw = getRawDb()
  raw
    .prepare(
      'INSERT OR REPLACE INTO props (id, project_id, name, category, description, thumbnail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      prop.id,
      prop.project_id,
      prop.name,
      prop.category,
      prop.description,
      prop.thumbnail,
      prop.created_at,
    )
}

export function updateProp(prop: PropRow): void {
  const raw = getRawDb()
  raw
    .prepare(
      'UPDATE props SET name = ?, category = ?, description = ?, thumbnail = ? WHERE id = ?',
    )
    .run(
      prop.name,
      prop.category,
      prop.description,
      prop.thumbnail,
      prop.id,
    )
}

export function replacePropsByProject(payload: { projectId: string; props: PropRow[] }): void {
  runInTransaction((raw) => {
    raw.prepare('DELETE FROM props WHERE project_id = ?').run(payload.projectId)
    const insertStmt = raw.prepare(
      'INSERT INTO props (id, project_id, name, category, description, thumbnail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    for (const prop of payload.props) {
      insertStmt.run(
        prop.id,
        payload.projectId,
        prop.name,
        prop.category,
        prop.description,
        prop.thumbnail,
        prop.created_at,
      )
    }
  })
}

export function deleteProp(id: string): void {
  const raw = getRawDb()
  raw.prepare('DELETE FROM props WHERE id = ?').run(id)
}
