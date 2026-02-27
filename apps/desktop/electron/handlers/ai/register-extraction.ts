import { ipcMain } from 'electron'
import { generateText } from 'ai'
import type { AIConfig } from '@openframe/providers'
import { store } from '../../store'
import { resolveTextModel } from './model'
import {
  CHARACTER_AGE_CANONICAL_PROMPT,
  CharacterExtractRow,
  CharacterRelationExtractRow,
  PropExtractRow,
  SceneExtractRow,
  ShotExtractRow,
  extractJsonObject,
  normalizeCharacterAge,
  normalizeCharacterGender,
  parseCharacters,
  parseCharacterRelations,
  parseProps,
  parseScenes,
  parseShots,
  shortError,
  toText,
} from './shared'

function detectScriptLanguage(script: string): 'zh' | 'en' {
  const chineseChars = (script.match(/[\u4e00-\u9fff]/g) || []).length
  const latinChars = (script.match(/[A-Za-z]/g) || []).length
  return chineseChars >= latinChars ? 'zh' : 'en'
}

function getOutputLanguageRules(
  script: string,
  domain: 'character' | 'scene' | 'prop' | 'shot',
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

const EXTRACTION_PROMPT_DEFAULTS = {
  extractCharactersFromScript: [
    'You are a screenplay analyst.',
    'Extract key characters from the script and summarize each one.',
    'Age must be one of: {{characterAgeCanonical}}.',
    'Character text fields (name/personality/appearance/background) must be written in {{outputLanguage}}.',
    '{{languageRule}}',
    'Return STRICT JSON only with shape:',
    '{"characters":[{"name":"","gender":"","age":"","personality":"","appearance":"","background":""}]}',
    'Do not include markdown code fences.',
    'Infer unknown fields conservatively; keep them short.',
    'Script:\n{{script}}',
  ].join('\n\n'),
  enhanceCharacterFromScript: [
    'You are a screenplay character designer.',
    'Enhance one character card using the script context.',
    'Age must be one of: {{characterAgeCanonical}}.',
    'Character text fields (name/personality/appearance/background) must be written in {{outputLanguage}}.',
    '{{languageRule}}',
    'Return STRICT JSON only with shape:',
    '{"character":{"name":"","gender":"","age":"","personality":"","appearance":"","background":""}}',
    'Keep the same character identity and name.',
    'Do not include markdown code fences.',
    'Current character:\n{{currentCharacter}}',
    'Script:\n{{script}}',
  ].join('\n\n'),
  extractScenesFromScript: [
    'You are a screenplay scene planner.',
    'Extract key scenes from the script with concise production-ready info.',
    'A scene means a continuous block in one primary location and time period.',
    'Do NOT treat plot events/beats/actions as separate scenes.',
    'If multiple events happen continuously in the same location/time, merge them into one scene.',
    'Scene title must describe the setting or scene unit, not an event statement.',
    'Bad title examples (event-level): "Argument erupts", "Finds a clue".',
    'Good title examples (scene-level): "Police Station Interrogation Room", "Rooftop at Night".',
    'All text fields (title/location/time/mood/description/shot_notes) must be written in {{outputLanguage}}.',
    '{{languageRule}}',
    'Return STRICT JSON only with shape:',
    '{"scenes":[{"title":"","location":"","time":"","mood":"","description":"","shot_notes":""}]}',
    'Do not include markdown code fences.',
    'Keep each field concise and actionable.',
    'Script:\n{{script}}',
  ].join('\n\n'),
  extractPropsFromScript: [
    'You are a screenplay production designer.',
    'Extract key props from the script with concise production-ready info.',
    'All text fields (name/category/description) must be written in {{outputLanguage}}.',
    '{{languageRule}}',
    'Return STRICT JSON only with shape:',
    '{"props":[{"name":"","category":"","description":""}]}',
    'Do not include markdown code fences.',
    'Keep each field concise and actionable.',
    'Do not output characters or scenes in props list unless they are clearly used as physical objects.',
    'Script:\n{{script}}',
  ].join('\n\n'),
  extractCharacterRelationsFromScript: [
    'You are a screenplay relationship analyst.',
    'Extract project-level character relationships from the script.',
    'When existing relations are provided, treat them as baseline and optimize them with script evidence.',
    'Prefer updating existing links (type, strength, notes, evidence) before adding new links.',
    'Each relationship must use only IDs from the provided character list.',
    'No invented characters or IDs. No self-relations.',
    'strength must be an integer from 1 to 5, where 5 is the strongest tie/conflict.',
    'Return STRICT JSON only with shape:',
    '{"relations":[{"source_ref":"","target_ref":"","relation_type":"","strength":3,"notes":"","evidence":""}]}',
    'relation_type examples: family, ally, friend, rival, enemy, mentor, subordinate, lover, business, mystery.',
    'notes should be concise relationship summary; evidence should mention key script clue.',
    'Do not include markdown code fences.',
    'Characters:\n{{characters}}',
    'Existing relations:\n{{existingRelations}}',
    'Script:\n{{script}}',
  ].join('\n\n'),
  enhanceSceneFromScript: [
    'You are a screenplay scene planner.',
    'Enhance one scene card based on script context.',
    'All text fields (title/location/time/mood/description/shot_notes) must be written in {{outputLanguage}}.',
    '{{languageRule}}',
    'Return STRICT JSON only with shape:',
    '{"scene":{"title":"","location":"","time":"","mood":"","description":"","shot_notes":""}}',
    'Do not include markdown code fences.',
    'Current scene:\n{{currentScene}}',
    'Script:\n{{script}}',
  ].join('\n\n'),
  extractShotsFromScript: [
    'You are a screenplay storyboard planner.',
    'Generate a practical shot list from the script.',
    '{{targetCountSection}}',
    'Narrative text fields (title/shot_size/camera_angle/camera_move/action/dialogue) must be written in {{outputLanguage}}.',
    '{{languageRule}}',
    'Maximize shot count as much as reasonably possible while staying faithful to the script.',
    'Prefer finer granularity: split each scene into many short, meaningful beats instead of merging beats into long shots.',
    'If uncertain between fewer vs more shots, choose more shots.',
    'Cover the script from start to end with exhaustive beat coverage; avoid skipping transitions or intermediate actions.',
    'Shots must form a coherent sequence with smooth transitions between adjacent shots.',
    'Preserve visual continuity across neighboring shots: screen direction, eyeline, character positions, and action progression.',
    'Use scene switches only when motivated by the script narrative progression.',
    'Avoid disconnected or repetitive shots that do not advance the beat from the previous shot.',
    'Continuity detail must be very strong: adjacent shots should read like consecutive moments in the same ongoing action unless the script explicitly jumps.',
    'Keep action text specific and stateful, inheriting important props/poses/positions from prior shots when applicable.',
    'Character relations are soft guidance only, not hard constraints.',
    'Use relations to bias pairings, shot contrast, and emotional framing when script evidence allows.',
    'Never override explicit script actions, chronology, or participant list just to match relations.',
    'Each shot must include scene_ref, character_refs, and prop_refs, using ONLY provided IDs.',
    'Do not invent new scene_ref / character_refs / prop_refs values.',
    'Return STRICT JSON only with shape:',
    '{"shots":[{"title":"","scene_ref":"","character_refs":[],"prop_refs":[],"shot_size":"","camera_angle":"","camera_move":"","duration_sec":3,"action":"","dialogue":""}]}',
    'Keep each shot concise and production-usable.',
    'duration_sec should usually be between 1 and 5 unless the script clearly requires otherwise.',
    'Do not include markdown code fences.',
    'Scenes:\n{{scenes}}',
    'Characters:\n{{characters}}',
    'Character relations:\n{{relations}}',
    'Props:\n{{props}}',
    'Script:\n{{script}}',
  ].join('\n\n'),
} as const

type ExtractionPromptKey = keyof typeof EXTRACTION_PROMPT_DEFAULTS

function getPromptOverrideTemplate(key: ExtractionPromptKey): string {
  const raw = store.get('prompt_overrides')
  if (typeof raw !== 'string' || !raw.trim()) {
    return EXTRACTION_PROMPT_DEFAULTS[key]
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const override = parsed[key]
    if (typeof override === 'string' && override.trim()) {
      return override
    }
  } catch {
    // ignore bad config
  }
  return EXTRACTION_PROMPT_DEFAULTS[key]
}

function renderPromptTemplate(
  template: string,
  variables: Record<string, string | number | boolean | null | undefined>,
): string {
  return template
    .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, token: string) => {
      const value = variables[token]
      if (value === null || value === undefined) return ''
      return String(value)
    })
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()
}

function buildExtractionPrompt(
  key: ExtractionPromptKey,
  variables: Record<string, string | number | boolean | null | undefined>,
): string {
  return renderPromptTemplate(getPromptOverrideTemplate(key), variables)
}

export function registerAIExtractionHandlers() {
  ipcMain.handle(
    'ai:extractCharactersFromScript',
    async (
      _event,
      params: { script: string; modelKey?: string },
    ): Promise<{ ok: true; characters: CharacterExtractRow[] } | { ok: false; error: string }> => {
      const config = store.get('ai_config') as AIConfig
      const model = resolveTextModel(config, params.modelKey)
      if (!model) return { ok: false, error: 'No default text model configured.' }
      const { outputLanguage, languageRule } = getOutputLanguageRules(params.script, 'character')

      const prompt = buildExtractionPrompt('extractCharactersFromScript', {
        characterAgeCanonical: CHARACTER_AGE_CANONICAL_PROMPT.join(' / '),
        outputLanguage,
        languageRule,
        script: params.script,
      })

      try {
        const { text } = await generateText({ model, prompt })
        return { ok: true, characters: parseCharacters(text) }
      } catch (err: unknown) {
        return { ok: false, error: shortError(err) }
      }
    },
  )

  ipcMain.handle(
    'ai:enhanceCharacterFromScript',
    async (
      _event,
      params: {
        script: string
        character: { name: string; gender?: string; age?: string; personality?: string; appearance?: string; background?: string }
        modelKey?: string
      },
    ): Promise<{ ok: true; character: CharacterExtractRow } | { ok: false; error: string }> => {
      const config = store.get('ai_config') as AIConfig
      const model = resolveTextModel(config, params.modelKey)
      if (!model) return { ok: false, error: 'No default text model configured.' }
      const { outputLanguage, languageRule } = getOutputLanguageRules(params.script, 'character')

      const prompt = buildExtractionPrompt('enhanceCharacterFromScript', {
        characterAgeCanonical: CHARACTER_AGE_CANONICAL_PROMPT.join(' / '),
        outputLanguage,
        languageRule,
        currentCharacter: JSON.stringify(params.character),
        script: params.script,
      })

      try {
        const { text } = await generateText({ model, prompt })
        const parsed = extractJsonObject(text)
        const raw = (parsed?.character ?? {}) as Record<string, unknown>
        const character: CharacterExtractRow = {
          name: toText(raw.name).trim() || params.character.name,
          gender: normalizeCharacterGender(toText(raw.gender)) || normalizeCharacterGender(params.character.gender || ''),
          age: normalizeCharacterAge(toText(raw.age)) || normalizeCharacterAge(params.character.age || ''),
          personality: toText(raw.personality).trim() || params.character.personality || '',
          appearance: toText(raw.appearance).trim() || params.character.appearance || '',
          background: toText(raw.background).trim() || params.character.background || '',
        }
        if (!character.name) {
          return { ok: false, error: 'Failed to parse character from model response.' }
        }
        return { ok: true, character }
      } catch (err: unknown) {
        return { ok: false, error: shortError(err) }
      }
    },
  )

  ipcMain.handle(
    'ai:extractScenesFromScript',
    async (
      _event,
      params: { script: string; modelKey?: string },
    ): Promise<{ ok: true; scenes: SceneExtractRow[] } | { ok: false; error: string }> => {
      const config = store.get('ai_config') as AIConfig
      const model = resolveTextModel(config, params.modelKey)
      if (!model) return { ok: false, error: 'No default text model configured.' }
      const { outputLanguage, languageRule } = getOutputLanguageRules(params.script, 'scene')

      const prompt = buildExtractionPrompt('extractScenesFromScript', {
        outputLanguage,
        languageRule,
        script: params.script,
      })

      try {
        const { text } = await generateText({ model, prompt })
        return { ok: true, scenes: parseScenes(text) }
      } catch (err: unknown) {
        return { ok: false, error: shortError(err) }
      }
    },
  )

  ipcMain.handle(
    'ai:extractPropsFromScript',
    async (
      _event,
      params: { script: string; modelKey?: string },
    ): Promise<{ ok: true; props: PropExtractRow[] } | { ok: false; error: string }> => {
      const config = store.get('ai_config') as AIConfig
      const model = resolveTextModel(config, params.modelKey)
      if (!model) return { ok: false, error: 'No default text model configured.' }
      const { outputLanguage, languageRule } = getOutputLanguageRules(params.script, 'prop')

      const prompt = buildExtractionPrompt('extractPropsFromScript', {
        outputLanguage,
        languageRule,
        script: params.script,
      })

      try {
        const { text } = await generateText({ model, prompt })
        return { ok: true, props: parseProps(text) }
      } catch (err: unknown) {
        return { ok: false, error: shortError(err) }
      }
    },
  )

  ipcMain.handle(
    'ai:extractCharacterRelationsFromScript',
    async (
      _event,
      params: {
        script: string
        characters: Array<{ id: string; name: string; personality?: string; background?: string }>
        existingRelations?: Array<{
          source_ref: string
          target_ref: string
          relation_type: string
          strength?: number
          notes?: string
          evidence?: string
        }>
        modelKey?: string
      },
    ): Promise<{ ok: true; relations: CharacterRelationExtractRow[] } | { ok: false; error: string }> => {
      const config = store.get('ai_config') as AIConfig
      const model = resolveTextModel(config, params.modelKey)
      if (!model) return { ok: false, error: 'No default text model configured.' }

      if (!Array.isArray(params.characters) || params.characters.length < 2) {
        return { ok: true, relations: [] }
      }

      const existingRelations = Array.isArray(params.existingRelations)
        ? params.existingRelations
          .map((item) => {
            const strengthValue =
              typeof item.strength === 'number'
                ? item.strength
                : typeof item.strength === 'string'
                  ? Number(item.strength)
                  : 3
            const strength = Number.isFinite(strengthValue)
              ? Math.max(1, Math.min(5, Math.round(strengthValue)))
              : 3
            return {
              source_ref: toText(item.source_ref).trim(),
              target_ref: toText(item.target_ref).trim(),
              relation_type: toText(item.relation_type).trim(),
              strength,
              notes: toText(item.notes).trim(),
              evidence: toText(item.evidence).trim(),
            }
          })
          .filter((row) => row.source_ref && row.target_ref && row.source_ref !== row.target_ref)
        : []

      const prompt = buildExtractionPrompt('extractCharacterRelationsFromScript', {
        characters: JSON.stringify(params.characters),
        existingRelations: JSON.stringify(existingRelations),
        script: params.script,
      })

      try {
        const { text } = await generateText({ model, prompt })
        return { ok: true, relations: parseCharacterRelations(text) }
      } catch (err: unknown) {
        return { ok: false, error: shortError(err) }
      }
    },
  )

  ipcMain.handle(
    'ai:enhanceSceneFromScript',
    async (
      _event,
      params: {
        script: string
        scene: {
          title: string
          location?: string
          time?: string
          mood?: string
          description?: string
          shot_notes?: string
        }
        modelKey?: string
      },
    ): Promise<{ ok: true; scene: SceneExtractRow } | { ok: false; error: string }> => {
      const config = store.get('ai_config') as AIConfig
      const model = resolveTextModel(config, params.modelKey)
      if (!model) return { ok: false, error: 'No default text model configured.' }
      const { outputLanguage, languageRule } = getOutputLanguageRules(params.script, 'scene')

      const prompt = buildExtractionPrompt('enhanceSceneFromScript', {
        outputLanguage,
        languageRule,
        currentScene: JSON.stringify(params.scene),
        script: params.script,
      })

      try {
        const { text } = await generateText({ model, prompt })
        const parsed = extractJsonObject(text)
        const raw = (parsed?.scene ?? {}) as Record<string, unknown>
        const scene: SceneExtractRow = {
          title: toText(raw.title).trim() || params.scene.title,
          location: toText(raw.location).trim() || params.scene.location || '',
          time: toText(raw.time).trim() || params.scene.time || '',
          mood: toText(raw.mood).trim() || params.scene.mood || '',
          description: toText(raw.description).trim() || params.scene.description || '',
          shot_notes: toText(raw.shot_notes).trim() || params.scene.shot_notes || '',
        }
        if (!scene.title) {
          return { ok: false, error: 'Failed to parse scene from model response.' }
        }
        return { ok: true, scene }
      } catch (err: unknown) {
        return { ok: false, error: shortError(err) }
      }
    },
  )

  ipcMain.handle(
    'ai:extractShotsFromScript',
    async (
      _event,
      params: {
        script: string
        scenes: Array<{
          id: string
          title: string
          location?: string
          time?: string
          mood?: string
          description?: string
          shot_notes?: string
        }>
        characters: Array<{ id: string; name: string }>
        relations?: Array<{
          source_ref: string
          target_ref: string
          relation_type: string
          strength?: number
          notes?: string
          evidence?: string
        }>
        props: Array<{ id: string; name: string; category?: string; description?: string }>
        target_count?: number
        modelKey?: string
      },
    ): Promise<{ ok: true; shots: ShotExtractRow[] } | { ok: false; error: string }> => {
      const config = store.get('ai_config') as AIConfig
      const model = resolveTextModel(config, params.modelKey)
      if (!model) return { ok: false, error: 'No default text model configured.' }
      const { outputLanguage, languageRule } = getOutputLanguageRules(params.script, 'shot')
      const rawTargetCount = typeof params.target_count === 'number' ? params.target_count : Number.NaN
      const targetCount = Number.isFinite(rawTargetCount)
        ? Math.max(1, Math.min(200, Math.round(rawTargetCount)))
        : null

      const relations = Array.isArray(params.relations)
        ? params.relations
          .map((item) => {
            const strengthValue =
              typeof item.strength === 'number'
                ? item.strength
                : typeof item.strength === 'string'
                  ? Number(item.strength)
                  : 3
            const strength = Number.isFinite(strengthValue)
              ? Math.max(1, Math.min(5, Math.round(strengthValue)))
              : 3
            return {
              source_ref: toText(item.source_ref).trim(),
              target_ref: toText(item.target_ref).trim(),
              relation_type: toText(item.relation_type).trim(),
              strength,
              notes: toText(item.notes).trim(),
              evidence: toText(item.evidence).trim(),
            }
          })
          .filter((row) => row.source_ref && row.target_ref && row.source_ref !== row.target_ref)
        : []

      const targetCountSection = targetCount
        ? [
          `Target shot count: ${targetCount}.`,
          `Try to output close to ${targetCount} shots (allow small deviation only if script structure truly requires it).`,
        ].join('\n\n')
        : ''

      const prompt = buildExtractionPrompt('extractShotsFromScript', {
        targetCountSection,
        outputLanguage,
        languageRule,
        scenes: JSON.stringify(params.scenes),
        characters: JSON.stringify(params.characters),
        relations: JSON.stringify(relations),
        props: JSON.stringify(params.props),
        script: params.script,
      })

      try {
        const { text } = await generateText({ model, prompt })
        return { ok: true, shots: parseShots(text) }
      } catch (err: unknown) {
        return { ok: false, error: shortError(err) }
      }
    },
  )
}
