import type { ImageModel } from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AIProviderConfig } from '../config'
import { buildImageModel, generateImageWithProviderSupport } from './image'

const mocks = vi.hoisted(() => {
  return {
    createGoogleGenerativeAI: vi.fn(),
    googleImage: vi.fn(),
    generateImage: vi.fn(),
    generateQwenImage: vi.fn(),
    generateVolcengineImage: vi.fn(),
    generateOpenAICompatibleImage: vi.fn(),
  }
})

vi.mock('@ai-sdk/google', () => {
  return {
    createGoogleGenerativeAI: mocks.createGoogleGenerativeAI,
  }
})

vi.mock('ai', () => {
  return {
    generateImage: mocks.generateImage,
  }
})

vi.mock('./platforms/qwen', () => {
  return {
    generateQwenImage: mocks.generateQwenImage,
  }
})

vi.mock('./platforms/volcengine', () => {
  return {
    generateVolcengineImage: mocks.generateVolcengineImage,
  }
})

vi.mock('./platforms/openai-compatible-media', () => {
  return {
    generateOpenAICompatibleImage: mocks.generateOpenAICompatibleImage,
  }
})

const providerCfg: AIProviderConfig = {
  apiKey: 'test-key',
  baseUrl: 'https://example.test',
  enabled: true,
}

function fakeImageModel(): ImageModel {
  return { doGenerate: vi.fn() } as unknown as ImageModel
}

describe('image provider compatibility', () => {
  beforeEach(() => {
    mocks.createGoogleGenerativeAI.mockReset()
    mocks.googleImage.mockReset()
    mocks.generateImage.mockReset()
    mocks.generateQwenImage.mockReset()
    mocks.generateVolcengineImage.mockReset()
    mocks.generateOpenAICompatibleImage.mockReset()

    mocks.createGoogleGenerativeAI.mockReturnValue({
      image: mocks.googleImage,
    })
    mocks.googleImage.mockReturnValue({ _fake: 'google-image-model' })
    mocks.generateImage.mockResolvedValue({
      image: {
        uint8Array: new Uint8Array([1, 2, 3]),
        mediaType: 'image/png',
      },
    })
    mocks.generateQwenImage.mockResolvedValue({
      data: [7, 7, 7],
      mediaType: 'image/png',
    })
    mocks.generateVolcengineImage.mockResolvedValue({
      data: [8, 8, 8],
      mediaType: 'image/webp',
    })
    mocks.generateOpenAICompatibleImage.mockResolvedValue({
      data: [6, 6, 6],
      mediaType: 'image/jpeg',
    })
  })

  it('maps nano-banana alias to google native image model id', () => {
    const model = buildImageModel('google', 'nano-banana-pro', providerCfg)

    expect(mocks.createGoogleGenerativeAI).toHaveBeenCalledWith({
      apiKey: 'test-key',
      baseURL: 'https://example.test',
    })
    expect(mocks.googleImage).toHaveBeenCalledWith('gemini-2.5-flash-image')
    expect(model).toEqual({ _fake: 'google-image-model' })
  })

  it('maps nano bananer typo alias to google native image model id', () => {
    buildImageModel('google', 'nano bananer', providerCfg)
    expect(mocks.googleImage).toHaveBeenCalledWith('gemini-2.5-flash-image')
  })

  it('returns custom-rest model for non-built-in providers', () => {
    const model = buildImageModel('my-provider', 'img-v1', providerCfg) as {
      _tag: string
      providerId: string
      modelId: string
      modelType: string
    }

    expect(model).toMatchObject({
      _tag: 'custom-rest',
      providerId: 'my-provider',
      modelId: 'img-v1',
      modelType: 'image',
    })
  })

  it('returns null for built-in fallback provider when baseURL is missing', () => {
    const model = buildImageModel('anthropic', 'any-image-model', {
      apiKey: 'k',
      baseUrl: '',
      enabled: true,
    })

    expect(model).toBeNull()
  })

  it('passes size and aspect ratio to sdk generateImage when format is valid', async () => {
    await generateImageWithProviderSupport({
      model: fakeImageModel(),
      prompt: 'portrait of a cat',
      options: { size: '1024x1024', ratio: '16:9' },
    })

    const call = mocks.generateImage.mock.calls[0]?.[0]
    expect(call).toMatchObject({
      prompt: 'portrait of a cat',
      n: 1,
      size: '1024x1024',
      aspectRatio: '16:9',
    })
  })

  it('skips invalid size/ratio values for sdk models', async () => {
    await generateImageWithProviderSupport({
      model: fakeImageModel(),
      prompt: 'landscape',
      options: { size: '2k', ratio: 'adaptive' },
    })

    const call = mocks.generateImage.mock.calls[0]?.[0] as Record<string, unknown>
    expect(call.size).toBeUndefined()
    expect(call.aspectRatio).toBeUndefined()
  })

  it('retries text-only prompt on not found errors while keeping valid options', async () => {
    mocks.generateImage
      .mockRejectedValueOnce(new Error('model not found'))
      .mockResolvedValueOnce({
        image: {
          uint8Array: new Uint8Array([9, 9]),
          mediaType: 'image/webp',
        },
      })

    const result = await generateImageWithProviderSupport({
      model: fakeImageModel(),
      prompt: { text: 'test scene', images: [[1, 2, 3]] },
      options: { size: '768x768', ratio: '1:1' },
    })

    expect(mocks.generateImage).toHaveBeenCalledTimes(2)
    const firstCall = mocks.generateImage.mock.calls[0]?.[0] as Record<string, unknown>
    const secondCall = mocks.generateImage.mock.calls[1]?.[0] as Record<string, unknown>

    expect(typeof firstCall.prompt).toBe('object')
    expect(secondCall.prompt).toBe('test scene')
    expect(secondCall.size).toBe('768x768')
    expect(secondCall.aspectRatio).toBe('1:1')
    expect(result).toEqual({
      data: [9, 9],
      mediaType: 'image/webp',
    })
  })

  it('throws for qwen image requests with reference images in custom-rest adapter', async () => {
    await expect(
      generateImageWithProviderSupport({
        model: {
          _tag: 'custom-rest',
          providerId: 'qwen',
          modelId: 'wanx-v1',
          modelType: 'image',
          apiKey: 'k',
          baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        },
        prompt: { text: 'cat', images: [[1, 2, 3]] },
      }),
    ).rejects.toThrow('Qwen image API currently supports text prompt only in this adapter.')
  })

  it('calls qwen image adapter with size and ratio', async () => {
    const result = await generateImageWithProviderSupport({
      model: {
        _tag: 'custom-rest',
        providerId: 'qwen',
        modelId: 'wanx-v1',
        modelType: 'image',
        apiKey: 'k',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      },
      prompt: 'a mountain',
      options: { size: '1024x1024', ratio: '16:9' },
    })

    expect(mocks.generateQwenImage).toHaveBeenCalledWith({
      apiKey: 'k',
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      modelId: 'wanx-v1',
      prompt: 'a mountain',
      size: '1024x1024',
      ratio: '16:9',
    })
    expect(result).toEqual({
      data: [7, 7, 7],
      mediaType: 'image/png',
    })
  })

  it('throws clear errors when qwen/volcengine api key is missing', async () => {
    await expect(
      generateImageWithProviderSupport({
        model: {
          _tag: 'custom-rest',
          providerId: 'qwen',
          modelId: 'wanx-v1',
          modelType: 'image',
          apiKey: undefined,
          baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        },
        prompt: 'a mountain',
      }),
    ).rejects.toThrow('Qwen API key is missing.')

    await expect(
      generateImageWithProviderSupport({
        model: {
          _tag: 'custom-rest',
          providerId: 'volcengine',
          modelId: 'seedream-4.0',
          modelType: 'image',
          apiKey: undefined,
          baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        },
        prompt: 'a river',
      }),
    ).rejects.toThrow('Volcengine API key is missing.')
  })

  it('falls back to openai-compatible media adapter for generic custom-rest image providers', async () => {
    const result = await generateImageWithProviderSupport({
      model: {
        _tag: 'custom-rest',
        providerId: 'my-provider',
        modelId: 'img-v1',
        modelType: 'image',
        apiKey: 'k',
        baseUrl: 'https://api.custom.test/v1',
      },
      prompt: { text: 'scene', images: [[1, 2, 3], 'https://example.test/ref.png'] },
      options: { size: '768x768', ratio: '1:1' },
    })

    expect(mocks.generateOpenAICompatibleImage).toHaveBeenCalledWith({
      apiKey: 'k',
      baseURL: 'https://api.custom.test/v1',
      modelId: 'img-v1',
      prompt: 'scene',
      images: [[1, 2, 3], 'https://example.test/ref.png'],
      size: '768x768',
      ratio: '1:1',
    })
    expect(result).toEqual({
      data: [6, 6, 6],
      mediaType: 'image/jpeg',
    })
  })
})
