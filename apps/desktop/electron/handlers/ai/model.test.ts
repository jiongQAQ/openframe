import type { AIConfig } from '@openframe/providers'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveImageModel, resolveTextModel, resolveVideoModel } from './model'

const mocks = vi.hoisted(() => {
  return {
    createProviderModelWithType: vi.fn(),
    getDefaultTextModel: vi.fn(),
    getDefaultImageModel: vi.fn(),
    getDefaultVideoModel: vi.fn(),
    isLanguageModel: vi.fn(),
    isImageModel: vi.fn(),
    isVideoModel: vi.fn(),
    isCustomRestModel: vi.fn(),
  }
})

vi.mock('@openframe/providers/factory', () => {
  return {
    createProviderModelWithType: mocks.createProviderModelWithType,
    getDefaultTextModel: mocks.getDefaultTextModel,
    getDefaultImageModel: mocks.getDefaultImageModel,
    getDefaultVideoModel: mocks.getDefaultVideoModel,
    isLanguageModel: mocks.isLanguageModel,
    isImageModel: mocks.isImageModel,
    isVideoModel: mocks.isVideoModel,
    isCustomRestModel: mocks.isCustomRestModel,
  }
})

const config: AIConfig = {
  providers: {},
  customProviders: [],
  models: { text: '', image: '', video: '', embedding: '' },
  customModels: {},
  enabledModels: {},
  hiddenModels: {},
  concurrency: { image: 5, video: 5 },
}

describe('ai model resolver', () => {
  beforeEach(() => {
    mocks.createProviderModelWithType.mockReset()
    mocks.getDefaultTextModel.mockReset()
    mocks.getDefaultImageModel.mockReset()
    mocks.getDefaultVideoModel.mockReset()
    mocks.isLanguageModel.mockReset()
    mocks.isImageModel.mockReset()
    mocks.isVideoModel.mockReset()
    mocks.isCustomRestModel.mockReset()

    mocks.createProviderModelWithType.mockReturnValue(null)
    mocks.getDefaultTextModel.mockReturnValue(null)
    mocks.getDefaultImageModel.mockReturnValue(null)
    mocks.getDefaultVideoModel.mockReturnValue(null)
    mocks.isLanguageModel.mockReturnValue(false)
    mocks.isImageModel.mockReturnValue(false)
    mocks.isVideoModel.mockReturnValue(false)
    mocks.isCustomRestModel.mockReturnValue(false)
  })

  it('resolves explicit text model when selected model is a language model', () => {
    const selectedModel = { id: 'selected-text-model' }
    mocks.createProviderModelWithType.mockReturnValue(selectedModel)
    mocks.isLanguageModel.mockImplementation((value: unknown) => value === selectedModel)

    const result = resolveTextModel(config, 'openai:gpt-4o')

    expect(mocks.createProviderModelWithType).toHaveBeenCalledWith('openai', 'gpt-4o', 'text', config)
    expect(result).toBe(selectedModel)
  })

  it('falls back to default text model when selected model is invalid', () => {
    const invalidSelected = { id: 'not-text' }
    const defaultTextModel = { id: 'default-text' }
    mocks.createProviderModelWithType.mockReturnValue(invalidSelected)
    mocks.getDefaultTextModel.mockReturnValue(defaultTextModel)
    mocks.isLanguageModel.mockImplementation((value: unknown) => value === defaultTextModel)

    const result = resolveTextModel(config, 'openai:gpt-4o')

    expect(result).toBe(defaultTextModel)
  })

  it('returns image error when no image model is configured', () => {
    const result = resolveImageModel(config)

    expect(result).toEqual({ error: 'No default image model configured.' })
  })

  it('accepts default custom-rest image model when model key is malformed', () => {
    const customRestModel = { _tag: 'custom-rest', providerId: 'my-provider' }
    mocks.getDefaultImageModel.mockReturnValue(customRestModel)
    mocks.isCustomRestModel.mockImplementation((value: unknown) => value === customRestModel)

    const result = resolveImageModel(config, 'invalid-key')

    expect(mocks.createProviderModelWithType).not.toHaveBeenCalled()
    expect(result).toEqual({ model: customRestModel })
  })

  it('returns image type mismatch error for non-image non-custom models', () => {
    mocks.getDefaultImageModel.mockReturnValue({ id: 'text-like-model' })

    const result = resolveImageModel(config)

    expect(result).toEqual({ error: 'Selected model is not an image model.' })
  })

  it('resolves explicit video model when selected model is valid', () => {
    const selectedVideoModel = { id: 'selected-video-model' }
    mocks.createProviderModelWithType.mockReturnValue(selectedVideoModel)
    mocks.isVideoModel.mockImplementation((value: unknown) => value === selectedVideoModel)

    const result = resolveVideoModel(config, 'google:veo3')

    expect(mocks.createProviderModelWithType).toHaveBeenCalledWith('google', 'veo3', 'video', config)
    expect(result).toEqual({ model: selectedVideoModel })
  })

  it('returns video type mismatch error for non-video non-custom models', () => {
    mocks.getDefaultVideoModel.mockReturnValue({ id: 'not-video' })

    const result = resolveVideoModel(config)

    expect(result).toEqual({ error: 'Selected model is not a video model.' })
  })
})
