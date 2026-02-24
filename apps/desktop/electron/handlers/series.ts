import { ipcMain } from 'electron'
import { getRawDb } from '../db'

type SeriesRow = {
  id: string
  project_id: string
  title: string
  script: string
  sort_index: number
  thumbnail: string | null
  duration: number
  created_at: number
}

function syncProjectSeriesCount(projectId: string) {
  const raw = getRawDb()
  const row = raw
    .prepare('SELECT COUNT(*) as count FROM series WHERE project_id = ?')
    .get(projectId) as { count: number }
  raw.prepare('UPDATE projects SET series_count = ? WHERE id = ?').run(row.count, projectId)
}

export function registerSeriesHandlers() {
  ipcMain.handle('series:getAll', () => {
    const raw = getRawDb()
    return raw
      .prepare(
        'SELECT id, project_id, title, script, sort_index, thumbnail, duration, created_at FROM series ORDER BY created_at DESC',
      )
      .all() as SeriesRow[]
  })

  ipcMain.handle('series:getByProject', (_event, projectId: string) => {
    const raw = getRawDb()
    return raw
      .prepare(
        'SELECT id, project_id, title, script, sort_index, thumbnail, duration, created_at FROM series WHERE project_id = ? ORDER BY sort_index ASC, created_at ASC',
      )
      .all(projectId) as SeriesRow[]
  })

  ipcMain.handle('series:insert', (_event, series: SeriesRow) => {
    const raw = getRawDb()
    raw
      .prepare(
        'INSERT INTO series (id, project_id, title, script, sort_index, thumbnail, duration, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(series.id, series.project_id, series.title, series.script, series.sort_index, series.thumbnail, series.duration, series.created_at)
    syncProjectSeriesCount(series.project_id)
  })

  ipcMain.handle('series:update', (_event, series: SeriesRow) => {
    const raw = getRawDb()
    raw
      .prepare(
        'UPDATE series SET title = ?, script = ?, sort_index = ?, thumbnail = ?, duration = ? WHERE id = ?',
      )
      .run(series.title, series.script, series.sort_index, series.thumbnail, series.duration, series.id)
  })

  ipcMain.handle('series:delete', (_event, id: string) => {
    const raw = getRawDb()
    const row = raw.prepare('SELECT project_id FROM series WHERE id = ?').get(id) as { project_id: string } | undefined
    raw.prepare('DELETE FROM scenes WHERE series_id = ?').run(id)
    raw.prepare('DELETE FROM shots WHERE series_id = ?').run(id)
    raw.prepare('DELETE FROM series WHERE id = ?').run(id)
    if (row?.project_id) {
      syncProjectSeriesCount(row.project_id)
    }
  })
}
