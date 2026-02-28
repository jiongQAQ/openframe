<p align='center'>
  <img src='./apps/ui/public/logo.svg' alt='Openframe logo' width='120' />
</p>

# Openframe

Openframe 是一个 AI 驱动的剧本到生产工作台，支持 desktop 与 web 两种运行时。

[English](./README.md)

## 亮点

- 一站式流程：项目 -> 剧本 -> 角色/道具/场景 -> 分镜 -> 生产/导出
- 剧本编辑器内置 AI 工具：
  - 自动补全
  - 根据想法生成剧本
  - 根据小说片段改编剧本
  - 场景扩写 / 重写 / 对白润色 / 节奏诊断 / 连贯性检查
- 人物关系图谱：基于剧本提取并支持按当前剧本优化
- 核心提取链路支持语言对齐（角色 / 道具 / 场景 / 分镜）
- 分镜生成支持目标镜头数输入（数量越高通常越丰富）
- 角色/道具/场景/分镜缩略图支持点击大图预览
- 首次启动提供 Driver.js 风格引导

## 应用拆分

- `apps/desktop`：Electron 壳（桌面端）
- `apps/ui`：共享 UI 与业务逻辑
- `apps/web`：Web 壳 + 浏览器部署用 API 代理

## 运行时差异

### Desktop

- 持久化：SQLite（`better-sqlite3`）+ `electron-store`
- 原生能力：本地目录选择、媒体清理、原生导出
- 向量检索：desktop 运行时可用（`sqlite-vec`）

### Web

- 持久化：IndexedDB（替代 SQLite）
- 设置存储：`localStorage`（替代本地 settings JSON）
- 后端：仅 `/api/ai` 转发代理
- 数据面板隐藏 desktop 专属功能（打开/更改目录、媒体清理、本地媒体体积项）

## 技术栈

- Monorepo：`pnpm workspace`
- 桌面端：`Electron + React + Vite + TypeScript`
- Web 端：`Vite + React + Vercel Functions`
- UI：`Tailwind CSS + daisyUI + lucide-react`
- 编辑器：`TipTap`
- Desktop 数据层：`SQLite + better-sqlite3 + Drizzle schema`
- Web 数据层：`IndexedDB + localStorage`
- 本地响应式状态：`TanStack DB`
- AI 接入：`Vercel AI SDK + 自定义 REST Provider`

## 目录结构

```text
openframe/
  apps/
    desktop/                 # Electron 应用（main/preload/desktop shell）
    ui/                      # 共享 UI + 路由 + collections
    web/                     # Web 壳 + api/ai 代理路由
  packages/
    db/                      # 共享数据库 schema
    providers/               # AI provider / model 定义
    runtime-contract/        # 共享 Window/runtime 类型契约
    shared/                  # 共享常量/工具
```

## 环境要求

- Node.js（建议 LTS）
- `pnpm@9.12.2`
- Electron 打包平台：macOS / Windows / Linux

## 安装

```bash
pnpm install
```

`apps/desktop` 在 `postinstall` 会执行 `electron-rebuild`（`better-sqlite3`）。

## 常用命令

```bash
# 根目录
pnpm dev            # desktop 开发
pnpm dev:web        # web 开发（http://localhost:5170）
pnpm build
pnpm build:web
pnpm lint
pnpm test
pnpm db:generate
pnpm db:migrate

# 类型检查
pnpm -C apps/ui exec tsc --noEmit
pnpm -C apps/web exec tsc --noEmit
pnpm -C apps/desktop exec tsc --noEmit
```

## Web 部署（Vercel）

仓库内已提供 monorepo 版 `vercel.json`。

- 前端产物目录：`apps/web/dist`
- API 函数源码：`apps/web/api/**/*.ts`
- 对外 API 路径：`/api/ai`（rewrite 到 `/apps/web/api/ai`）

Vercel 控制台需注意：

- `Root Directory` 设为仓库根目录 `.`，不要设为 `apps/web`。

## 架构约束

- 渲染/UI 层不能直接访问 DB / 文件系统。
- 持久化与副作用统一走 `window.*API` 契约。
- 新增实体时（desktop + ui）需同步更新：
  1. `packages/db/schema.ts`
  2. `apps/desktop/electron/handlers/*.ts`
  3. `apps/desktop/electron/preload.ts`
  4. `packages/runtime-contract/index.d.ts`
  5. `apps/ui/src/db/*_collection.ts`
- Handler SQL 使用原生 `better-sqlite3`。
- 不要手改生成的 route tree 文件。

## 数据库与迁移

- Desktop 运行时数据库：`app.getPath('userData')/app.db`
- 迁移目录：`apps/desktop/electron/migrations/`

修改 schema 后执行：

```bash
pnpm -C apps/desktop db:generate
```

## i18n

新增文案需同时更新：

- `apps/ui/src/i18n/locales/en.ts`
- `apps/ui/src/i18n/locales/zh.ts`

## 常见问题

- `No default text model configured`：先在设置中配置并启用文本模型。
- 原生依赖构建失败：重跑 `pnpm install`，确认 `electron-rebuild` 成功。
- Vercel 未识别正确根目录或构建上下文：
  - 确认项目 `Root Directory = .`
  - 拉取最新 `vercel.json` 后重新部署
- Web 下 AI 不通：确认 `/api/ai` 已部署并可访问。

## 发布

- 推送 `v*` tag（如 `v0.7.0`）会触发发布流程。
- GitHub Actions 会构建 macOS / Windows / Linux 安装包并上传到 GitHub Release。
- Release Notes 自动生成（`.github/workflows/release-build.yml` 中 `generate_release_notes`）。
- macOS 发布需要签名凭据：
  - `CSC_LINK`、`CSC_KEY_PASSWORD`
- macOS 发布还需要公证凭据（满足任一组即可）：
  - `APPLE_API_KEY`、`APPLE_API_KEY_ID`、`APPLE_API_ISSUER`
  - 或 `APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`
