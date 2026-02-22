import { createRequire } from 'node:module'
import { app } from 'electron'
import path from 'node:path'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@openframe/db'

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3')

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null
let _sqlite: InstanceType<typeof Database> | null = null

export function getDb() {
  if (!_db) {
    const dbPath = path.join(app.getPath('userData'), 'app.db')
    _sqlite = new Database(dbPath)
    _sqlite.pragma('journal_mode = WAL')
    _db = drizzle(_sqlite, { schema })
    initSchema(_sqlite)
  }
  return _db
}

function initSchema(sqlite: InstanceType<typeof Database>) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      created_at INTEGER,
      updated_at INTEGER
    );
  `)
}

export function getRawDb() {
  getDb() // 确保已初始化
  return _sqlite!
}

export function closeDb() {
  _sqlite?.close()
  _db = null
  _sqlite = null
}
