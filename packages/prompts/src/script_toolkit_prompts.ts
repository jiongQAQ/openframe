export type ScriptToolkitAction =
  | 'scene.expand'
  | 'scene.autocomplete'
  | 'scene.rewrite'
  | 'scene.dialogue-polish'
  | 'scene.pacing'
  | 'scene.continuity-check'
  | 'script.from-idea'
  | 'script.from-novel'

export function detectTextLanguage(text: string): 'zh' | 'en' {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const latinChars = (text.match(/[A-Za-z]/g) || []).length
  return chineseChars >= latinChars ? 'zh' : 'en'
}

export function getScriptOutputRule(context: string): string {
  if (detectTextLanguage(context) === 'zh') {
    return [
      'Output language must be Simplified Chinese.',
      'Keep existing fixed proper nouns (names, brands, IDs) unchanged.',
      'Do not mix English screenplay tokens such as "INT.", "EXT.", "CUT TO:", "FLASH CUTS", "V.O." unless the user explicitly requests English formatting.',
    ].join(' ')
  }
  return 'Output language must be English. Keep screenplay headings, action lines, and dialogue consistently in English.'
}

const SCRIPT_TOOLKIT_ACTION_PROMPTS: Record<ScriptToolkitAction, string> = {
  'scene.expand':
    'Expand the current scene by enriching action beats, environment details, and emotional texture while preserving the original story intent and chronology. Return only the revised scene text.',
  'scene.autocomplete':
    'Continue writing from the cursor position with natural screenplay flow. Respect what appears before and after the cursor, and avoid repeating existing text. Keep clear paragraph and dialogue line breaks where appropriate. Return only the continuation text that should be inserted at cursor.',
  'scene.rewrite':
    'Rewrite the current scene for stronger readability and cinematic flow while keeping all core plot points and outcomes unchanged. Return only the rewritten scene text.',
  'scene.dialogue-polish':
    'Polish the dialogue in this scene to sound more natural and dramatic while preserving each character\'s intent. Keep scene actions intact. Return only the polished scene text.',
  'scene.pacing':
    'Diagnose pacing issues in this scene. Identify dragging lines, low-information paragraphs, and rhythm breaks. Return concise bullet points with actionable fixes.',
  'scene.continuity-check':
    'Check scene continuity: character states, time/space consistency, and prop/object continuity. Return concise bullet points with found issues and suggested fixes.',
  'script.from-idea':
    'Turn the idea into a complete screenplay segment with clear scene progression, visual actions, and natural dialogue. Output plain screenplay text only.',
  'script.from-novel':
    'Adapt the novel excerpt into a screenplay segment, preserving key plot beats and emotional intent while making it performable on screen. Output plain screenplay text only.',
}

export function getScriptToolkitPrompt(action: ScriptToolkitAction, context: string, instruction?: string): string {
  return [
    'You are an expert screenplay writing assistant.',
    SCRIPT_TOOLKIT_ACTION_PROMPTS[action],
    getScriptOutputRule(context),
    instruction ? `Extra instruction: ${instruction}` : '',
    'Keep character names, scene semantics, and chronology coherent.',
    'Do not include markdown code fences.',
    `Content:\n${context}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}
