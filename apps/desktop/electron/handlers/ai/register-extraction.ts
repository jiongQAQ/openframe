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

      const prompt = [
        'You are a screenplay analyst.',
        'Extract key characters from the script and summarize each one.',
        `Age must be one of: ${CHARACTER_AGE_CANONICAL_PROMPT.join(' / ')}.`,
        'Return STRICT JSON only with shape:',
        '{"characters":[{"name":"","gender":"","age":"","personality":"","appearance":"","background":""}]}',
        'Do not include markdown code fences.',
        'Infer unknown fields conservatively; keep them short.',
        `Script:\n${params.script}`,
      ].join('\n\n')

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

      const prompt = [
        'You are a screenplay character designer.',
        'Enhance one character card using the script context.',
        `Age must be one of: ${CHARACTER_AGE_CANONICAL_PROMPT.join(' / ')}.`,
        'Return STRICT JSON only with shape:',
        '{"character":{"name":"","gender":"","age":"","personality":"","appearance":"","background":""}}',
        'Keep the same character identity and name.',
        'Do not include markdown code fences.',
        `Current character:\n${JSON.stringify(params.character)}`,
        `Script:\n${params.script}`,
      ].join('\n\n')

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

      const prompt = [
        'You are a screenplay scene planner.',
        'Extract key scenes from the script with concise production-ready info.',
        'Return STRICT JSON only with shape:',
        '{"scenes":[{"title":"","location":"","time":"","mood":"","description":"","shot_notes":""}]}',
        'Do not include markdown code fences.',
        'Keep each field concise and actionable.',
        `Script:\n${params.script}`,
      ].join('\n\n')

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

      const prompt = [
        'You are a screenplay production designer.',
        'Extract key props from the script with concise production-ready info.',
        'Return STRICT JSON only with shape:',
        '{"props":[{"name":"","category":"","description":""}]}',
        'Do not include markdown code fences.',
        'Keep each field concise and actionable.',
        'Do not output characters or scenes in props list unless they are clearly used as physical objects.',
        `Script:\n${params.script}`,
      ].join('\n\n')

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

      const prompt = [
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
        `Characters:\n${JSON.stringify(params.characters)}`,
        `Existing relations:\n${JSON.stringify(existingRelations)}`,
        `Script:\n${params.script}`,
      ].join('\n\n')

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

      const prompt = [
        'You are a screenplay scene planner.',
        'Enhance one scene card based on script context.',
        'Return STRICT JSON only with shape:',
        '{"scene":{"title":"","location":"","time":"","mood":"","description":"","shot_notes":""}}',
        'Do not include markdown code fences.',
        `Current scene:\n${JSON.stringify(params.scene)}`,
        `Script:\n${params.script}`,
      ].join('\n\n')

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
        modelKey?: string
      },
    ): Promise<{ ok: true; shots: ShotExtractRow[] } | { ok: false; error: string }> => {
      const config = store.get('ai_config') as AIConfig
      const model = resolveTextModel(config, params.modelKey)
      if (!model) return { ok: false, error: 'No default text model configured.' }

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

      const prompt = [
        'You are a screenplay storyboard planner.',
        'Generate a practical shot list from the script.',
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
        `Scenes:\n${JSON.stringify(params.scenes)}`,
        `Characters:\n${JSON.stringify(params.characters)}`,
        `Character relations:\n${JSON.stringify(relations)}`,
        `Props:\n${JSON.stringify(params.props)}`,
        `Script:\n${params.script}`,
      ].join('\n\n')

      try {
        const { text } = await generateText({ model, prompt })
        return { ok: true, shots: parseShots(text) }
      } catch (err: unknown) {
        return { ok: false, error: shortError(err) }
      }
    },
  )
}
