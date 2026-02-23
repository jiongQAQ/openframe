import { ipcMain } from 'electron'
import { generateText } from 'ai'
import Store from 'electron-store'
import { createProviderModel, isLanguageModel } from '@openframe/providers/factory'
import { DEFAULT_AI_CONFIG, type AIConfig } from '@openframe/providers'

// ── AI config store ────────────────────────────────────────────────────────────

const modelKeySchema = { type: 'string', default: '' }

const providerConfigSchema = {
  type: 'object',
  properties: {
    apiKey:  { type: 'string', default: '' },
    baseUrl: { type: 'string', default: '' },
    enabled: { type: 'boolean', default: false },
  },
  default: { apiKey: '', baseUrl: '', enabled: false },
}

const modelDefSchema = {
  type: 'object',
  properties: {
    id:   { type: 'string' },
    name: { type: 'string' },
    type: { type: 'string', enum: ['text', 'image', 'video'] },
  },
  required: ['id', 'name', 'type'],
}

const aiStore = new Store<AIConfig>({
  name: 'ai-config',
  schema: {
    providers: {
      type: 'object',
      additionalProperties: providerConfigSchema,
      default: {},
    },
    models: {
      type: 'object',
      properties: {
        text:  modelKeySchema,
        image: modelKeySchema,
        video: modelKeySchema,
      },
      default: { text: '', image: '', video: '' },
    },
    customModels: {
      type: 'object',
      additionalProperties: {
        type: 'array',
        items: modelDefSchema,
        default: [],
      },
      default: {},
    },
    disabledModels: {
      type: 'object',
      additionalProperties: { type: 'boolean' },
      default: {},
    },
  },
  defaults: DEFAULT_AI_CONFIG,
})

// ── IPC handlers ───────────────────────────────────────────────────────────────

export function registerAIHandlers() {
  ipcMain.handle('ai:getConfig', (): AIConfig => aiStore.store)

  ipcMain.handle('ai:saveConfig', (_event, config: AIConfig) => {
    aiStore.store = config
  })

  ipcMain.handle(
    'ai:testConnection',
    async (
      _event,
      params: { providerId: string; modelId: string; apiKey: string; baseUrl?: string },
    ) => {
      const { providerId, modelId, apiKey, baseUrl } = params

      const config: AIConfig = {
        providers: {
          [providerId]: { apiKey, baseUrl: baseUrl ?? '', enabled: true },
        },
        models: { text: '', image: '', video: '' },
        customModels: {},
        disabledModels: {},
      }

      try {
        const model = createProviderModel(providerId, modelId, config)
        if (!model) return { ok: false, error: 'Provider not supported' }
        if (!isLanguageModel(model)) return { ok: false, error: 'Model type cannot be tested' }

        await generateText({ model, prompt: 'hi', maxOutputTokens: 1 })
        return { ok: true }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return { ok: false, error: msg.split('\n')[0].slice(0, 200) }
      }
    },
  )
}
