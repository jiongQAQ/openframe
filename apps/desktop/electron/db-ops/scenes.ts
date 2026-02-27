import { getRawDb } from '../db'
import { runInTransaction } from './tx'

export type SceneRow = {
  id: string
  series_id?: string
  project_id: string
  title: string
  location: string
  time: string
  mood: string
  description: string
  shot_notes: string
  thumbnail: string | null
  created_at: number
}

let scenesHasSeriesIdColumnCache: boolean | null = null

function hasScenesSeriesIdColumn(raw: ReturnType<typeof getRawDb>): boolean {
  if (scenesHasSeriesIdColumnCache != null) return scenesHasSeriesIdColumnCache
  const tableInfo = raw.prepare("PRAGMA table_info('scenes')").all() as Array<{ name: string }>
  const columns = new Set(tableInfo.map((column) => column.name))
  scenesHasSeriesIdColumnCache = columns.has('series_id')
  return scenesHasSeriesIdColumnCache
}

export function ensureScenesSchema(): void {
  const raw = getRawDb()
  raw.exec(
    'CREATE TABLE IF NOT EXISTS scenes (id text PRIMARY KEY NOT NULL, project_id text NOT NULL, title text NOT NULL DEFAULT \'\', location text NOT NULL DEFAULT \'\', time text NOT NULL DEFAULT \'\', mood text NOT NULL DEFAULT \'\', description text NOT NULL DEFAULT \'\', shot_notes text NOT NULL DEFAULT \'\', thumbnail text, created_at integer NOT NULL)',
  )

  const tableInfo = raw.prepare("PRAGMA table_info('scenes')").all() as Array<{ name: string }>
  const columns = new Set(tableInfo.map((column) => column.name))
  scenesHasSeriesIdColumnCache = columns.has('series_id')
  if (!columns.has('project_id')) {
    raw.exec('ALTER TABLE scenes ADD COLUMN project_id text')
  }
  if (columns.has('series_id')) {
    raw.exec(`
      UPDATE scenes
      SET project_id = (
        SELECT series.project_id
        FROM series
        WHERE series.id = scenes.series_id
        LIMIT 1
      )
      WHERE (project_id IS NULL OR project_id = '')
    `)
    raw.exec(`
      UPDATE scenes
      SET project_id = (
        SELECT series.project_id
        FROM shots
        INNER JOIN series ON series.id = shots.series_id
        WHERE shots.scene_id = scenes.id
        ORDER BY shots.created_at ASC
        LIMIT 1
      )
      WHERE (project_id IS NULL OR project_id = '')
    `)
  }
}

export function getAllScenes(): SceneRow[] {
  const raw = getRawDb()
  const hasSeriesId = hasScenesSeriesIdColumn(raw)
  const selectSql = hasSeriesId
    ? 'SELECT id, series_id, project_id, title, location, time, mood, description, shot_notes, thumbnail, created_at FROM scenes ORDER BY created_at DESC'
    : 'SELECT id, project_id, title, location, time, mood, description, shot_notes, thumbnail, created_at FROM scenes ORDER BY created_at DESC'
  return raw
    .prepare(selectSql)
    .all() as SceneRow[]
}

export function getScenesByProject(projectId: string): SceneRow[] {
  const raw = getRawDb()
  const hasSeriesId = hasScenesSeriesIdColumn(raw)
  const selectSql = hasSeriesId
    ? 'SELECT id, series_id, project_id, title, location, time, mood, description, shot_notes, thumbnail, created_at FROM scenes WHERE project_id = ? ORDER BY created_at ASC'
    : 'SELECT id, project_id, title, location, time, mood, description, shot_notes, thumbnail, created_at FROM scenes WHERE project_id = ? ORDER BY created_at ASC'
  return raw
    .prepare(selectSql)
    .all(projectId) as SceneRow[]
}

export function insertScene(scene: SceneRow): void {
  const raw = getRawDb()
  const hasSeriesId = hasScenesSeriesIdColumn(raw)
  if (hasSeriesId) {
    raw
      .prepare(
        'INSERT OR REPLACE INTO scenes (id, series_id, project_id, title, location, time, mood, description, shot_notes, thumbnail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        scene.id,
        scene.series_id ?? '',
        scene.project_id,
        scene.title,
        scene.location,
        scene.time,
        scene.mood,
        scene.description,
        scene.shot_notes,
        scene.thumbnail,
        scene.created_at,
      )
    return
  }

  raw
    .prepare(
      'INSERT OR REPLACE INTO scenes (id, project_id, title, location, time, mood, description, shot_notes, thumbnail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      scene.id,
      scene.project_id,
      scene.title,
      scene.location,
      scene.time,
      scene.mood,
      scene.description,
      scene.shot_notes,
      scene.thumbnail,
      scene.created_at,
    )
}

export function updateScene(scene: SceneRow): void {
  const raw = getRawDb()
  raw
    .prepare(
      'UPDATE scenes SET title = ?, location = ?, time = ?, mood = ?, description = ?, shot_notes = ?, thumbnail = ? WHERE id = ?',
    )
    .run(
      scene.title,
      scene.location,
      scene.time,
      scene.mood,
      scene.description,
      scene.shot_notes,
      scene.thumbnail,
      scene.id,
    )
}

export function replaceScenesByProject(payload: { projectId: string; scenes: SceneRow[] }): void {
  runInTransaction((raw) => {
    const hasSeriesId = hasScenesSeriesIdColumn(raw)
    raw
      .prepare('DELETE FROM shots WHERE scene_id IN (SELECT id FROM scenes WHERE project_id = ?)')
      .run(payload.projectId)
    raw.prepare('DELETE FROM scenes WHERE project_id = ?').run(payload.projectId)
    const insertStmt = hasSeriesId
      ? raw.prepare(
        'INSERT INTO scenes (id, series_id, project_id, title, location, time, mood, description, shot_notes, thumbnail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      : raw.prepare(
        'INSERT INTO scenes (id, project_id, title, location, time, mood, description, shot_notes, thumbnail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
    for (const scene of payload.scenes) {
      if (hasSeriesId) {
        insertStmt.run(
          scene.id,
          scene.series_id ?? '',
          payload.projectId,
          scene.title,
          scene.location,
          scene.time,
          scene.mood,
          scene.description,
          scene.shot_notes,
          scene.thumbnail,
          scene.created_at,
        )
      } else {
        insertStmt.run(
          scene.id,
          payload.projectId,
          scene.title,
          scene.location,
          scene.time,
          scene.mood,
          scene.description,
          scene.shot_notes,
          scene.thumbnail,
          scene.created_at,
        )
      }
    }
  })
}

export function deleteScene(id: string): void {
  runInTransaction((raw) => {
    raw.prepare('DELETE FROM shots WHERE scene_id = ?').run(id)
    raw.prepare('DELETE FROM scenes WHERE id = ?').run(id)
  })
}
