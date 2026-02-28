import { ipcMain } from 'electron'
import { generateText, streamText } from 'ai'
import type { AIConfig } from '@openframe/providers'
import { buildStyleAgentPrompt } from '@openframe/prompts'
import { store } from '../../store'
import { resolveTextModel } from './model'
import {
  extractJsonObject,
  getScriptToolkitPrompt,
  ScriptToolkitAction,
  shortError,
  stripCliStyleParams,
  StyleAgentMessage,
  StyleDraft,
  toText,
} from './shared'

export function registerAIStyleAndScriptHandlers() {
  ipcMain.handle(
    'ai:styleAgentChat',
    async (
      _event,
      params: { messages: StyleAgentMessage[]; draft: StyleDraft; modelKey?: string },
    ): Promise<{ ok: true; reply: string; draft: StyleDraft } | { ok: false; error: string }> => {
      const config = store.get('ai_config') as AIConfig
      const model = resolveTextModel(config, params.modelKey)
      if (!model) return { ok: false, error: 'No default text model configured.' }

      const prompt = buildStyleAgentPrompt({
        messages: params.messages,
        draft: params.draft,
      })

      try {
        const { text } = await generateText({ model, prompt })
        const parsed = extractJsonObject(text)
        if (!parsed) return { ok: false, error: 'Failed to parse model response.' }

        const draftRaw = (parsed.draft ?? {}) as Record<string, unknown>
        return {
          ok: true,
          reply: toText(parsed.reply) || 'Done. I updated the draft for you.',
          draft: {
            name: toText(draftRaw.name) || params.draft.name,
            code: toText(draftRaw.code) || params.draft.code,
            description: toText(draftRaw.description) || params.draft.description,
            prompt: stripCliStyleParams(toText(draftRaw.prompt)) || params.draft.prompt,
          },
        }
      } catch (err: unknown) {
        return { ok: false, error: shortError(err) }
      }
    },
  )

  ipcMain.handle(
    'ai:scriptToolkit',
    async (
      _event,
      params: { action: ScriptToolkitAction; context: string; instruction?: string; modelKey?: string },
    ): Promise<{ ok: true; text: string } | { ok: false; error: string }> => {
      const config = store.get('ai_config') as AIConfig
      const model = resolveTextModel(config, params.modelKey)
      if (!model) return { ok: false, error: 'No default text model configured.' }

      const prompt = getScriptToolkitPrompt(params.action, params.context, params.instruction)

      try {
        const { text } = await generateText({ model, prompt })
        return { ok: true, text: text.trim() }
      } catch (err: unknown) {
        return { ok: false, error: shortError(err) }
      }
    },
  )

  ipcMain.handle(
    'ai:scriptToolkitStreamStart',
    async (
      event,
      params: {
        action: ScriptToolkitAction
        context: string
        instruction?: string
        modelKey?: string
      },
    ): Promise<{ ok: true; requestId: string } | { ok: false; error: string }> => {
      const config = store.get('ai_config') as AIConfig
      const model = resolveTextModel(config, params.modelKey)
      if (!model) return { ok: false, error: 'No default text model configured.' }

      if (params.action !== 'scene.expand' && params.action !== 'scene.autocomplete') {
        return { ok: false, error: 'Streaming is currently supported only for scene.expand and scene.autocomplete.' }
      }

      const requestId = crypto.randomUUID()
      const prompt = getScriptToolkitPrompt(params.action, params.context, params.instruction)

      void (async () => {
        try {
          const result = streamText({
            model,
            prompt,
            maxOutputTokens: params.action === 'scene.autocomplete' ? 10 : undefined,
          })
          for await (const chunk of result.textStream) {
            if (event.sender.isDestroyed()) return
            event.sender.send('ai:scriptToolkitStreamChunk', {
              requestId,
              chunk,
              done: false,
            })
          }
          if (!event.sender.isDestroyed()) {
            event.sender.send('ai:scriptToolkitStreamChunk', {
              requestId,
              done: true,
            })
          }
        } catch (err: unknown) {
          if (!event.sender.isDestroyed()) {
            event.sender.send('ai:scriptToolkitStreamChunk', {
              requestId,
              done: true,
              error: shortError(err),
            })
          }
        }
      })()

      return { ok: true, requestId }
    },
  )
}
