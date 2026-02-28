export type StyleAgentMessage = { role: 'user' | 'assistant'; content: string }
export type StyleDraft = { name: string; code: string; description: string; prompt: string }

export function buildStyleAgentPrompt(args: {
  messages: StyleAgentMessage[]
  draft: StyleDraft
}): string {
  const conversation = args.messages
    .map((message) => `${message.role === 'assistant' ? 'Assistant' : 'User'}: ${message.content}`)
    .join('\n\n')

  const instruction = [
    'You are a style-library creation agent for an image/video prompt app.',
    'Based on the conversation and current draft, suggest improved values.',
    'In draft.prompt, NEVER include CLI-style flags or suffix params such as "--ar 16:9", "--stylize 300", "--v 6", etc.',
    'Write natural prompt text only.',
    'Return STRICT JSON only. No markdown. No extra text.',
    'JSON shape:',
    '{',
    '  "reply": "short conversational reply in same language as user",',
    '  "draft": {',
    '    "name": "style name",',
    '    "code": "snake_case_code",',
    '    "description": "short description",',
    '    "prompt": "full reusable prompt template"',
    '  }',
    '}',
    'If a field should stay unchanged, copy it from current draft.',
  ].join('\n')

  const currentDraft = JSON.stringify(args.draft)
  return `${instruction}\n\nCurrent draft:\n${currentDraft}\n\nConversation:\n${conversation}`
}
