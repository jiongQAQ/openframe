interface SqliteAPI {
  /** 执行 INSERT / UPDATE / DELETE，返回影响行数和最后插入的 rowid */
  query(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid: number }>
  /** 执行 SELECT，返回所有行 */
  select<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
}

declare global {
  interface Window {
    sqlite: SqliteAPI
  }
}

export {}
