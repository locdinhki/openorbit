# 12.3: Built-in Skills

**Effort:** Medium | **Status:** Complete

## Background

Three proof-of-concept skills validate the framework. The voice transcription skill wraps the existing `VoiceTranscriber` class. The calculator and formatter are new implementations.

## Tasks

### Voice Transcribe Skill
- [x] Create `packages/core/src/skills/builtin/voice-transcribe-skill.ts`
  - `id: 'voice-transcribe'`, `category: 'media'`
  - Input: `{ audioPath: string, model?: string }`
  - Output: `{ transcript, durationSeconds, model }`
  - Wraps `VoiceTranscriber` from `packages/core/src/audio/voice-transcriber.ts`
  - Accepts optional `openaiApiKey` from settings for API fallback

### Calculator Skill
- [x] Create `packages/core/src/skills/builtin/calc-skill.ts`
  - `id: 'calc-expression'`, `category: 'data'`
  - Input: `{ expression: string }`
  - Output: `{ result: number, expression: string }`
  - Safe evaluator (no raw `eval`), validates input characters + identifier allowlist
  - Supports: `+`, `-`, `*`, `/`, `%`, `^`, `()`, `sqrt`, `abs`, `ceil`, `floor`, `round`, `pi`

### Data Format Skill
- [x] Create `packages/core/src/skills/builtin/format-skill.ts`
  - `id: 'data-format'`, `category: 'data'`
  - Input: `{ data: string, from: 'json' | 'csv', to: 'json' | 'csv' | 'pretty-json' }`
  - Output: `{ formatted: string, rowCount: number }`
  - CSV parser handles quoted fields, commas in values, newlines (RFC 4180)

### Registration
- [x] Register all 3 in `src/main/index.ts` with `extensionId: 'shell'`

## Built-in Skills Summary

| Skill ID | Name | Category | Offline | AI Tool |
|----------|------|----------|---------|---------|
| `voice-transcribe` | Voice Transcriber | media | Yes (CLI) / No (API) | Yes |
| `calc-expression` | Calculator | data | Yes | Yes |
| `data-format` | Data Formatter | data | Yes | Yes |
