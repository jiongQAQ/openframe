import { describe, expect, it } from 'vitest'
import { AI_PROVIDERS, getAllProviders, getProviderById, isBuiltInProvider } from './providers'

describe('providers registry', () => {
  it('identifies built-in providers', () => {
    expect(isBuiltInProvider('openai')).toBe(true)
    expect(isBuiltInProvider('not-exists')).toBe(false)
  })

  it('returns builtin list directly when no custom providers are passed', () => {
    expect(getAllProviders()).toBe(AI_PROVIDERS)
  })

  it('normalizes custom providers and skips duplicates/invalid/builtin ids', () => {
    const all = getAllProviders([
      {
        id: '  custom-a ',
        name: '   ',
        noApiKey: true,
        defaultBaseUrl: ' https://custom-a.test ',
      },
      {
        id: 'openai',
        name: 'Should Be Ignored',
      },
      {
        id: 'custom-a',
        name: 'Duplicated',
      },
      {
        id: '',
        name: 'Invalid',
      },
    ])

    const custom = all[all.length - 1]
    expect(custom).toEqual({
      id: 'custom-a',
      name: 'custom-a',
      models: [],
      noApiKey: true,
      defaultBaseUrl: 'https://custom-a.test',
    })
    expect(all.filter((provider) => provider.id === 'custom-a')).toHaveLength(1)
    expect(all.some((provider) => provider.id === 'openai')).toBe(true)
  })

  it('resolves providers by id from builtin and custom definitions', () => {
    const customProviders = [{ id: 'my-provider', name: 'My Provider' }]

    expect(getProviderById('openai')).toMatchObject({ id: 'openai' })
    expect(getProviderById('my-provider', customProviders)).toEqual({
      id: 'my-provider',
      name: 'My Provider',
      models: [],
    })
    expect(getProviderById('not-exists', customProviders)).toBeUndefined()
  })
})
