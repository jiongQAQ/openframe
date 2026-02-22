import { defineConfig } from 'drizzle-kit'
import os from 'node:os'
import path from 'node:path'

export default defineConfig({
  dialect: 'sqlite',
  schema: '../../packages/db/schema.ts',
  out: './electron/migrations',
  dbCredentials: {
    // 仅供 drizzle-kit studio / generate 使用（开发环境 macOS 路径）
    url: path.join(os.homedir(), 'Library/Application Support/openframe/app.db'),
  },
})
