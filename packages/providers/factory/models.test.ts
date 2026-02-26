import type { AIConfig } from '../config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createModelFromKey,
  createProviderModel,
  createProviderModelWithType,
  getDefaultImageModel,
  getDefaultModel,
  getDefaultTextModel,
  getDefaultVideoModel,
} from './models'

const mocks = vi.hoisted(() => {
  return {
    buildTextModel: vi.fn(),
    buildImageModel: vi.fn(),
    buildVideoModel: vi.fn(),
  }
})

vi.mock('./text', () => ({
  buildTextModel: mocks.buildTextModel,
}))

vi.mock('./image', () => ({
  buildImageModel: mocks.buildImageModel,
}))

vi.mock('./video', () => ({
  buildVideoModel: mocks.buildVideoModel,
}))

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

describe('factory models', () => {
  beforeEach(() => {
    mocks.buildTextModel.mockReset()
    mocks.buildImageModel.mockReset()
    mocks.buildVideoModel.mockReset()

    mocks.buildTextModel.mockReturnValue({ _kind: 'text-model' })
    mocks.buildImageModel.mockReturnValue({ _kind: 'image-model' })
    mocks.buildVideoModel.mockReturnValue({ _kind: 'video-model' })
  })

  it('returns null when provider config is missing', () => {
    const config = createConfig()
    expect(createProviderModel('openai', 'gpt-4o', config)).toBeNull()
  })

  it('resolves model type from custom models and applies provider default base url fallback', () => {
    const config = createConfig({
      providers: {
        custom: { apiKey: 'k', baseUrl: '', enabled: true },
      },
      customProviders: [
        { id: 'custom', name: 'Custom', defaultBaseUrl: 'https://custom.example.com' },
      ],
      customModels: {
        custom: [{ id: 'video-1', name: 'Video 1', type: 'video' }],
      },
    })

    const result = createProviderModel('custom', 'video-1', config)

    expect(result).toEqual({ _kind: 'video-model' })
    expect(mocks.buildVideoModel).toHaveBeenCalledWith('custom', 'video-1', {
      apiKey: 'k',
      baseUrl: 'https://custom.example.com',
      enabled: true,
    })
  })

  it('defaults unresolved model type to text', () => {
    const config = createConfig({
      providers: {
        openai: { apiKey: 'k', baseUrl: 'https://api.example.com', enabled: true },
      },
    })

    createProviderModel('openai', 'unknown-model', config)

    expect(mocks.buildTextModel).toHaveBeenCalledWith('openai', 'unknown-model', {
      apiKey: 'k',
      baseUrl: 'https://api.example.com',
      enabled: true,
    })
    expect(mocks.buildImageModel).not.toHaveBeenCalled()
    expect(mocks.buildVideoModel).not.toHaveBeenCalled()
  })

  it('builds model with explicit type and returns null for embedding type', () => {
    const config = createConfig({
      providers: {
        openai: { apiKey: 'k', baseUrl: 'https://api.example.com', enabled: true },
      },
    })

    const imageModel = createProviderModelWithType('openai', 'gpt-image-1', 'image', config)
    const embeddingModel = createProviderModelWithType('openai', 'text-embedding-3-small', 'embedding', config)

    expect(imageModel).toEqual({ _kind: 'image-model' })
    expect(embeddingModel).toBeNull()
  })

  it('creates model from provider:model key and handles invalid keys', () => {
    const config = createConfig({
      providers: {
        openai: { apiKey: 'k', baseUrl: 'https://api.example.com', enabled: true },
      },
      customModels: {
        openai: [{ id: 'img-1', name: 'Image 1', type: 'image' }],
      },
    })

    expect(createModelFromKey('openai:img-1', config)).toEqual({ _kind: 'image-model' })
    expect(createModelFromKey('bad-key', config)).toBeNull()
  })

  it('returns default model by type and typed accessors', () => {
    const config = createConfig({
      providers: {
        openai: { apiKey: 'k', baseUrl: 'https://api.example.com', enabled: true },
      },
      customModels: {
        openai: [
          { id: 'txt-1', name: 'Text 1', type: 'text' },
          { id: 'img-1', name: 'Image 1', type: 'image' },
          { id: 'vid-1', name: 'Video 1', type: 'video' },
        ],
      },
      models: {
        text: 'openai:txt-1',
        image: 'openai:img-1',
        video: 'openai:vid-1',
        embedding: '',
      },
    })

    expect(getDefaultModel('text', config)).toEqual({ _kind: 'text-model' })
    expect(getDefaultTextModel(config)).toEqual({ _kind: 'text-model' })
    expect(getDefaultImageModel(config)).toEqual({ _kind: 'image-model' })
    expect(getDefaultVideoModel(config)).toEqual({ _kind: 'video-model' })
    expect(getDefaultModel('embedding', config)).toBeNull()
  })
})
