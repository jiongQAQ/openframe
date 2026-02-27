import { getRawDb } from '../db'
import { runInTransaction } from './tx'

export type CharacterRelationRow = {
  id: string
  project_id: string
  source_character_id: string
  target_character_id: string
  relation_type: string
  strength: number
  notes: string
  evidence: string
  created_at: number
}

export function ensureCharacterRelationsSchema(): void {
  const raw = getRawDb()
  raw.exec(
    "CREATE TABLE IF NOT EXISTS character_relations (id text PRIMARY KEY NOT NULL, project_id text NOT NULL, source_character_id text NOT NULL, target_character_id text NOT NULL, relation_type text NOT NULL DEFAULT '', strength integer NOT NULL DEFAULT 3, notes text NOT NULL DEFAULT '', evidence text NOT NULL DEFAULT '', created_at integer NOT NULL)",
  )

  const tableInfo = raw.prepare("PRAGMA table_info('character_relations')").all() as Array<{ name: string }>
  const columns = new Set(tableInfo.map((column) => column.name))

  if (!columns.has('relation_type')) {
    raw.exec("ALTER TABLE character_relations ADD COLUMN relation_type text NOT NULL DEFAULT ''")
  }
  if (!columns.has('strength')) {
    raw.exec('ALTER TABLE character_relations ADD COLUMN strength integer NOT NULL DEFAULT 3')
  }
  if (!columns.has('notes')) {
    raw.exec("ALTER TABLE character_relations ADD COLUMN notes text NOT NULL DEFAULT ''")
  }
  if (!columns.has('evidence')) {
    raw.exec("ALTER TABLE character_relations ADD COLUMN evidence text NOT NULL DEFAULT ''")
  }

  raw.exec("UPDATE character_relations SET relation_type = '' WHERE relation_type IS NULL")
  raw.exec('UPDATE character_relations SET strength = 3 WHERE strength IS NULL')
  raw.exec("UPDATE character_relations SET notes = '' WHERE notes IS NULL")
  raw.exec("UPDATE character_relations SET evidence = '' WHERE evidence IS NULL")
}

export function getAllCharacterRelations(): CharacterRelationRow[] {
  const raw = getRawDb()
  return raw
    .prepare(
      'SELECT id, project_id, source_character_id, target_character_id, relation_type, strength, notes, evidence, created_at FROM character_relations ORDER BY created_at DESC',
    )
    .all() as CharacterRelationRow[]
}

export function getCharacterRelationsByProject(projectId: string): CharacterRelationRow[] {
  const raw = getRawDb()
  return raw
    .prepare(
      'SELECT id, project_id, source_character_id, target_character_id, relation_type, strength, notes, evidence, created_at FROM character_relations WHERE project_id = ? ORDER BY created_at ASC',
    )
    .all(projectId) as CharacterRelationRow[]
}

export function insertCharacterRelation(row: CharacterRelationRow): void {
  const raw = getRawDb()
  raw
    .prepare(
      'INSERT OR REPLACE INTO character_relations (id, project_id, source_character_id, target_character_id, relation_type, strength, notes, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      row.id,
      row.project_id,
      row.source_character_id,
      row.target_character_id,
      row.relation_type,
      row.strength,
      row.notes,
      row.evidence,
      row.created_at,
    )
}

export function updateCharacterRelation(row: CharacterRelationRow): void {
  const raw = getRawDb()
  raw
    .prepare(
      'UPDATE character_relations SET source_character_id = ?, target_character_id = ?, relation_type = ?, strength = ?, notes = ?, evidence = ? WHERE id = ?',
    )
    .run(
      row.source_character_id,
      row.target_character_id,
      row.relation_type,
      row.strength,
      row.notes,
      row.evidence,
      row.id,
    )
}

export function replaceCharacterRelationsByProject(payload: { projectId: string; relations: CharacterRelationRow[] }): void {
  runInTransaction((raw) => {
    raw.prepare('DELETE FROM character_relations WHERE project_id = ?').run(payload.projectId)

    const insertStmt = raw.prepare(
      'INSERT INTO character_relations (id, project_id, source_character_id, target_character_id, relation_type, strength, notes, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )

    for (const row of payload.relations) {
      insertStmt.run(
        row.id,
        payload.projectId,
        row.source_character_id,
        row.target_character_id,
        row.relation_type,
        row.strength,
        row.notes,
        row.evidence,
        row.created_at,
      )
    }
  })
}

export function deleteCharacterRelation(id: string): void {
  const raw = getRawDb()
  raw.prepare('DELETE FROM character_relations WHERE id = ?').run(id)
}
