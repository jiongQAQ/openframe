import {
  DEFAULT_PROMPT_OVERRIDES,
  parsePromptOverridesFromSetting,
  renderPromptTemplate,
  type PromptOverrideKey,
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

export type ExtractionDomain = 'character' | 'scene' | 'prop' | 'shot'

export function detectScriptLanguage(script: string): 'zh' | 'en' {
  const chineseChars = (script.match(/[\u4e00-\u9fff]/g) || []).length
  const latinChars = (script.match(/[A-Za-z]/g) || []).length
  return chineseChars >= latinChars ? 'zh' : 'en'
}

export function getExtractionOutputLanguageRules(
  script: string,
  domain: ExtractionDomain,
): { outputLanguage: 'Simplified Chinese' | 'English'; languageRule: string } {
  const isZh = detectScriptLanguage(script) === 'zh'
  if (domain === 'character') {
    return isZh
      ? {
        outputLanguage: 'Simplified Chinese',
        languageRule: 'If the script is Chinese, do not translate character text fields into English unless the script itself uses English proper nouns.',
      }
      : {
        outputLanguage: 'English',
        languageRule: 'If the script is English, keep all character text fields in English.',
      }
  }
  if (domain === 'scene') {
    return isZh
      ? {
        outputLanguage: 'Simplified Chinese',
        languageRule: 'If the script is Chinese, do not translate scene fields into English unless the script itself uses English proper nouns.',
      }
      : {
        outputLanguage: 'English',
        languageRule: 'If the script is English, keep all scene fields in English.',
      }
  }
  if (domain === 'prop') {
    return isZh
      ? {
        outputLanguage: 'Simplified Chinese',
        languageRule: 'If the script is Chinese, do not translate prop text into English unless the script itself uses English proper nouns.',
      }
      : {
        outputLanguage: 'English',
        languageRule: 'If the script is English, keep all prop text in English.',
      }
  }
  return isZh
    ? {
      outputLanguage: 'Simplified Chinese',
      languageRule: 'If the script is Chinese, do not translate shot text into English unless the script itself uses English proper nouns.',
    }
    : {
      outputLanguage: 'English',
      languageRule: 'If the script is English, keep all shot text fields in English.',
    }
}

export function getExtractionPromptTemplate(
  key: ExtractionPromptKey,
  overridesRaw?: string | null,
): string {
  if (typeof overridesRaw !== 'string' || !overridesRaw.trim()) {
    return DEFAULT_PROMPT_OVERRIDES[key]
  }
  const parsed = parsePromptOverridesFromSetting(overridesRaw)
  return parsed[key] || DEFAULT_PROMPT_OVERRIDES[key]
}

export function buildExtractionPrompt(args: {
  key: ExtractionPromptKey
  variables: ExtractionPromptVariables
  overridesRaw?: string | null
}): string {
  return renderPromptTemplate(
    getExtractionPromptTemplate(args.key, args.overridesRaw),
    args.variables,
  )
}
