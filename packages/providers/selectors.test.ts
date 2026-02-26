import { describe, expect, it } from 'vitest'
import type { AIConfig } from './config'
import {
  getEnabledProviderModels,
  getProviderModels,
  getSelectableModelsByType,
  getVisibleProviderModels,
} from './selectors'

function createConfig(partial: Partial<AIConfig> = {}): AIConfig {
  return {
    providers: {},
    customProviders: [],
    models: { text: '', image: '', video: '', embedding: '' },
    customModels: {},
    enabledModels: {},
    hiddenModels: {},
    concurrency: { image: 5, video: 5 },
    ...partial,
  }
}

describe('selectors', () => {
  it('returns empty list when provider does not exist', () => {
    const config = createConfig()
    expect(getProviderModels('not-found', config)).toEqual([])
  })

  it('merges builtin and custom models with optional type filter', () => {
    const config = createConfig({
      customModels: {
        openai: [
          { id: 'custom-image', name: 'Custom Image', type: 'image' },
          { id: 'custom-text', name: 'Custom Text', type: 'text' },
        ],
      },
    })

    const all = getProviderModels('openai', config)
    const images = getProviderModels('openai', config, 'image')

    expect(all.some((model) => model.id === 'custom-image')).toBe(true)
    expect(all.some((model) => model.id === 'custom-text')).toBe(true)
    expect(images.some((model) => model.id === 'custom-image')).toBe(true)
    expect(images.every((model) => model.type === 'image')).toBe(true)
  })

  it('applies hidden and enabled model filters by provider:model key', () => {
    const config = createConfig({
      enabledModels: {
        'openai:gpt-4o': true,
      },
      hiddenModels: {
        'openai:gpt-4o-mini': true,
      },
    })

    const visible = getVisibleProviderModels('openai', config, 'text')
    const enabled = getEnabledProviderModels('openai', config, 'text')

    expect(visible.some((model) => model.id === 'gpt-4o-mini')).toBe(false)
    expect(enabled.map((model) => model.id)).toContain('gpt-4o')
    expect(enabled.some((model) => model.id === 'gpt-4o-mini')).toBe(false)
  })

  it('returns selectable models grouped by enabled providers only', () => {
    const config = createConfig({
      providers: {
        openai: { apiKey: 'k', baseUrl: '', enabled: true },
        google: { apiKey: 'k', baseUrl: '', enabled: false },
      },
      enabledModels: {
        'openai:gpt-image-1': true,
      },
    })

    const selectable = getSelectableModelsByType(config, 'image')

    expect(selectable).toHaveLength(1)
    expect(selectable[0]?.provider.id).toBe('openai')
    expect(selectable[0]?.models.some((model) => model.id === 'gpt-image-1')).toBe(true)
  })
})
