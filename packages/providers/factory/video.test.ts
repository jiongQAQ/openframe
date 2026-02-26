import type { Experimental_VideoModelV3 } from '@ai-sdk/provider'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AIProviderConfig } from '../config'
import { buildVideoModel, generateVideoWithProviderSupport } from './video'

const mocks = vi.hoisted(() => {
  return {
    createGoogleGenerativeAI: vi.fn(),
    googleVideo: vi.fn(),
    experimentalGenerateVideo: vi.fn(),
    generateVolcengineVideo: vi.fn(),
    generateOpenAICompatibleVideo: vi.fn(),
  }
})

vi.mock('@ai-sdk/google', () => {
  return {
    createGoogleGenerativeAI: mocks.createGoogleGenerativeAI,
  }
})

vi.mock('ai', () => {
  return {
    experimental_generateVideo: mocks.experimentalGenerateVideo,
  }
})

vi.mock('./platforms/volcengine', () => {
  return {
    generateVolcengineVideo: mocks.generateVolcengineVideo,
  }
})

vi.mock('./platforms/openai-compatible-media', () => {
  return {
    generateOpenAICompatibleVideo: mocks.generateOpenAICompatibleVideo,
  }
})

const providerCfg: AIProviderConfig = {
  apiKey: 'test-key',
  baseUrl: 'https://example.test',
  enabled: true,
}

function fakeVideoModel(provider: string, modelId: string): Experimental_VideoModelV3 {
  return {
    specificationVersion: 'v3',
    provider,
    modelId,
    maxVideosPerCall: 1,
    doGenerate: vi.fn(),
  } as unknown as Experimental_VideoModelV3
}

describe('video provider compatibility', () => {
  beforeEach(() => {
    mocks.createGoogleGenerativeAI.mockReset()
    mocks.googleVideo.mockReset()
    mocks.experimentalGenerateVideo.mockReset()
    mocks.generateVolcengineVideo.mockReset()
    mocks.generateOpenAICompatibleVideo.mockReset()

    mocks.createGoogleGenerativeAI.mockReturnValue({
      video: mocks.googleVideo,
    })
    mocks.googleVideo.mockReturnValue({ _fake: 'google-video-model' })
    mocks.experimentalGenerateVideo.mockResolvedValue({
      video: {
        uint8Array: new Uint8Array([1, 2]),
        mediaType: 'video/mp4',
      },
    })
    mocks.generateVolcengineVideo.mockResolvedValue({
      data: [4, 4, 4],
      mediaType: 'video/mp4',
    })
    mocks.generateOpenAICompatibleVideo.mockResolvedValue({
      data: [5, 5, 5],
      mediaType: 'video/webm',
    })
  })

  it('maps veo3 alias to google native video model id', () => {
    const model = buildVideoModel('google', 'veo3', providerCfg)

    expect(mocks.createGoogleGenerativeAI).toHaveBeenCalledWith({
      apiKey: 'test-key',
      baseURL: 'https://example.test',
    })
    expect(mocks.googleVideo).toHaveBeenCalledWith('veo-3.1-generate-preview')
    expect(model).toEqual({ _fake: 'google-video-model' })
  })

  it('maps veo3-fast and veo2 aliases to google native ids', () => {
    buildVideoModel('google', 'veo3-fast', providerCfg)
    buildVideoModel('google', 'veo2', providerCfg)

    expect(mocks.googleVideo).toHaveBeenNthCalledWith(1, 'veo-3.1-fast-generate-preview')
    expect(mocks.googleVideo).toHaveBeenNthCalledWith(2, 'veo-2.0-generate-001')
  })

  it('returns custom-rest model for non-built-in providers', () => {
    const model = buildVideoModel('my-provider', 'video-v1', providerCfg) as {
      _tag: string
      providerId: string
      modelId: string
      modelType: string
    }

    expect(model).toMatchObject({
      _tag: 'custom-rest',
      providerId: 'my-provider',
      modelId: 'video-v1',
      modelType: 'video',
    })
  })

  it('returns null for built-in fallback provider when baseURL is missing', () => {
    const model = buildVideoModel('openai', 'video-v1', {
      apiKey: 'k',
      baseUrl: '',
      enabled: true,
    })

    expect(model).toBeNull()
  })

  it('passes referenceUrls for alibaba r2v models', async () => {
    await generateVideoWithProviderSupport({
      model: fakeVideoModel('alibaba.video', 'wan2.6-r2v'),
      prompt: {
        text: 'turn references into one shot',
        images: [[1, 2, 3], 'https://example.test/ref-last.png'],
      },
      options: { ratio: '16:9', durationSec: 5 },
    })

    const call = mocks.experimentalGenerateVideo.mock.calls[0]?.[0] as {
      prompt: unknown
      providerOptions?: { alibaba?: { referenceUrls?: string[] } }
      aspectRatio?: string
      duration?: number
    }

    expect(call.prompt).toBe('turn references into one shot')
    expect(call.aspectRatio).toBe('16:9')
    expect(call.duration).toBe(5)

    const refs = call.providerOptions?.alibaba?.referenceUrls ?? []
    expect(refs).toHaveLength(2)
    expect(refs[0]).toMatch(/^data:image\/png;base64,/)
    expect(refs[1]).toBe('https://example.test/ref-last.png')
  })

  it('uses first image as sdk image prompt for non-r2v models', async () => {
    await generateVideoWithProviderSupport({
      model: fakeVideoModel('alibaba.video', 'wan2.6-i2v'),
      prompt: {
        text: 'animate first frame',
        images: [[4, 5, 6], 'https://example.test/ignored.png'],
      },
      options: { ratio: '9:16', durationSec: 3 },
    })

    const call = mocks.experimentalGenerateVideo.mock.calls[0]?.[0] as {
      prompt: { image: unknown; text?: string }
      providerOptions?: unknown
    }

    expect(call.prompt).toMatchObject({ text: 'animate first frame' })
    expect(call.prompt.image).toBeInstanceOf(Uint8Array)
    expect(call.providerOptions).toBeUndefined()
  })

  it('does not pass providerOptions for r2v model when no references exist', async () => {
    await generateVideoWithProviderSupport({
      model: fakeVideoModel('alibaba.video', 'wan2.6-r2v'),
      prompt: 'text only',
      options: { ratio: 'invalid-ratio' },
    })

    const call = mocks.experimentalGenerateVideo.mock.calls[0]?.[0] as {
      prompt: unknown
      providerOptions?: unknown
      aspectRatio?: unknown
    }

    expect(call.prompt).toBe('text only')
    expect(call.providerOptions).toBeUndefined()
    expect(call.aspectRatio).toBeUndefined()
  })

  it('routes volcengine custom-rest generation with prompt/images/options', async () => {
    const result = await generateVideoWithProviderSupport({
      model: {
        _tag: 'custom-rest',
        providerId: 'volcengine',
        modelId: 'doubao-seedance-1.0-pro-250528',
        modelType: 'video',
        apiKey: 'k',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      },
      prompt: {
        text: 'make it cinematic',
        images: [[1, 2, 3], 'https://example.test/ref.png'],
      },
      options: { ratio: '21:9', durationSec: 6 },
    })

    expect(mocks.generateVolcengineVideo).toHaveBeenCalledWith({
      modelId: 'doubao-seedance-1.0-pro-250528',
      apiKey: 'k',
      baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
      prompt: 'make it cinematic',
      images: [[1, 2, 3], 'https://example.test/ref.png'],
      ratio: '21:9',
      durationSec: 6,
    })
    expect(result).toEqual({
      data: [4, 4, 4],
      mediaType: 'video/mp4',
    })
  })

  it('throws clear error when volcengine custom-rest key is missing', async () => {
    await expect(
      generateVideoWithProviderSupport({
        model: {
          _tag: 'custom-rest',
          providerId: 'volcengine',
          modelId: 'doubao-seedance-1.0-pro-250528',
          modelType: 'video',
          apiKey: undefined,
          baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        },
        prompt: 'test',
      }),
    ).rejects.toThrow('Volcengine API key is missing.')
  })

  it('falls back to openai-compatible adapter for generic custom-rest video providers', async () => {
    const result = await generateVideoWithProviderSupport({
      model: {
        _tag: 'custom-rest',
        providerId: 'my-provider',
        modelId: 'video-v1',
        modelType: 'video',
        apiKey: 'k',
        baseUrl: 'https://api.custom.test/v1',
      },
      prompt: { text: 'sunrise', images: [[9, 8, 7]] },
      options: { ratio: '9:16', durationSec: 3 },
    })

    expect(mocks.generateOpenAICompatibleVideo).toHaveBeenCalledWith({
      apiKey: 'k',
      baseURL: 'https://api.custom.test/v1',
      modelId: 'video-v1',
      prompt: 'sunrise',
      images: [[9, 8, 7]],
      ratio: '9:16',
      durationSec: 3,
    })
    expect(result).toEqual({
      data: [5, 5, 5],
      mediaType: 'video/webm',
    })
  })
})
