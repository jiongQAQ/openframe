import {
  parsePromptOverridesFromSetting,
  renderPromptTemplate,
  type PromptLanguage,
  type PromptOverrideKey,
  normalizePromptLanguage,
} from './prompt_overrides'

export type ExtractionPromptKey = Extract<
  PromptOverrideKey,
  | 'extractCharactersFromScript'
  | 'enhanceCharacterFromScript'
  | 'extractScenesFromScript'
  | 'enhanceSceneFromScript'
  | 'extractPropsFromScript'
  | 'extractCharacterRelationsFromScript'
  | 'extractShotsFromScript'
>

export type ExtractionPromptVariables = Record<string, string | number | boolean | null | undefined>

export function detectScriptLanguage(script: string): PromptLanguage {
  const chineseChars = (script.match(/[\u4e00-\u9fff]/g) || []).length
  const latinChars = (script.match(/[A-Za-z]/g) || []).length
  return chineseChars >= latinChars ? 'zh' : 'en'
}

export function resolveExtractionPromptLanguage(args: {
  language?: string | null
  script?: string
}): PromptLanguage {
  if (args.language) return normalizePromptLanguage(args.language)
  if (typeof args.script === 'string' && args.script.trim()) {
    return detectScriptLanguage(args.script)
  }
  return 'en'
}

export function getExtractionPromptTemplate(args: {
  key: ExtractionPromptKey
  overridesRaw?: string | null
  language?: string | null
  script?: string
}): string {
  const targetLanguage = resolveExtractionPromptLanguage({
    language: args.language,
    script: args.script,
  })
  return parsePromptOverridesFromSetting(args.overridesRaw, targetLanguage)[args.key]
}

export function buildExtractionPrompt(args: {
  key: ExtractionPromptKey
  variables: ExtractionPromptVariables
  overridesRaw?: string | null
  language?: string | null
  script?: string
}): string {
  return renderPromptTemplate(
    getExtractionPromptTemplate({
      key: args.key,
      overridesRaw: args.overridesRaw,
      language: args.language,
      script: args.script,
    }),
    args.variables,
  )
}
