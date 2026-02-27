# 10.5: Voice Messages

**Effort:** Medium | **Status:** Complete

## Background

Users send voice messages on Telegram, iMessage, WhatsApp, and Discord. Currently these are ignored — the AI gateway only processes text. Adding speech-to-text (STT) lets users talk to OpenOrbit naturally: "approve the Stripe job" or "what's my status?" without typing.

[Whisper](https://github.com/openai/whisper) (OpenAI's open-source STT model) runs locally via the Python CLI. It auto-downloads models on first use — no API key, no cloud dependency, no cost. Processing happens entirely on the user's Mac.

Reference: [OpenClaw audio node](https://docs.openclaw.ai/nodes/audio)

## How It Works

```
User sends voice message (any channel)
    |
    |-- Channel extension receives audio attachment
    |       |
    |       |-- Download audio to temp file
    |       |-- Validate file size (< 20MB)
    |       |
    |       |-- Voice Transcriber
    |       |       |
    |       |       |-- whisper CLI (Python): auto-downloads model, runs locally
    |       |       |-- Output: transcript text
    |       |       |-- Fallback: OpenAI Whisper API (if configured)
    |       |       |
    |       |       |-- Returns transcript string
    |       |
    |       |-- AI Gateway receives transcript as text
    |       |       |-- Same flow as any text message
    |       |       |-- Direct commands, AI fallback, memory extraction
    |       |
    |       |-- Response sent back as text message
```

Voice messages are converted to text, then processed exactly like any other message. The transcription step is transparent to the AI gateway.

## Tasks

### Voice Transcriber (`packages/core/src/audio/voice-transcriber.ts`)
- [ ] Create shared transcriber utility in core (used by all channel extensions)
- [ ] Primary: spawn `whisper` Python CLI with audio file path
- [ ] Model selection: `tiny` (fast, ~1s) for short messages, `base` (better accuracy) for longer
- [ ] Auto-download: Whisper downloads models on first run (~75MB for tiny, ~140MB for base)
- [ ] Parse CLI output → extract transcript text
- [ ] Timeout: 60 seconds per transcription (kill process if exceeded)
- [ ] Max file size: 20MB (reject larger files with user-friendly message)
- [ ] Fallback: OpenAI Whisper API (`/v1/audio/transcriptions`) if Python Whisper unavailable and OpenAI API key is configured
- [ ] `isAvailable()` check: verify `whisper` CLI is in PATH
- [ ] Temp file cleanup after transcription

### Audio Format Support
- [ ] Accept common voice message formats: OGG/Opus (Telegram, WhatsApp), CAF (iMessage), WebM (Discord)
- [ ] Whisper handles most formats natively via ffmpeg
- [ ] Require `ffmpeg` in PATH (log warning if missing, since Whisper depends on it)

### Channel Integration

Each messaging extension adds voice message handling:

**ext-telegram:**
- [ ] Detect `voice` and `audio` message types in update handler
- [ ] Download file via `getFile` + `file_path` Telegram API
- [ ] Transcribe → forward transcript to AI Gateway
- [ ] Reply with "[Voice] transcript" prefix for transparency (optional)

**ext-imessage:**
- [ ] Detect audio attachments in webhook payload
- [ ] Download from BlueBubbles attachment API
- [ ] Transcribe → forward to AI Gateway

**ext-whatsapp:**
- [ ] Detect `audioMessage` type in Baileys message handler
- [ ] Download audio buffer from message
- [ ] Transcribe → forward to AI Gateway

**ext-discord:**
- [ ] Detect voice message attachments (content_type starts with `audio/`)
- [ ] Download from Discord CDN URL
- [ ] Transcribe → forward to AI Gateway

### Settings
- [ ] `voice.whisper-model` — model size: `tiny` (default), `base`, `small`, `medium`
- [ ] `voice.enabled` — enable/disable voice processing (default: true)
- [ ] `voice.max-file-size` — max audio file size in bytes (default: 20MB)

## Voice Transcriber Specification

```typescript
export interface TranscriptionResult {
  transcript: string
  durationSeconds: number
  model: string
}

export class VoiceTranscriber {
  constructor(options?: { model?: string; maxFileSize?: number; timeoutMs?: number })

  /** Check if whisper CLI is available */
  isAvailable(): Promise<boolean>

  /** Transcribe audio file to text */
  transcribe(audioPath: string): Promise<TranscriptionResult>
}
```

### Whisper CLI Usage

```bash
# Whisper auto-downloads model on first run
whisper audio.ogg --model tiny --output_format txt --output_dir /tmp

# Output: /tmp/audio.txt containing the transcript
```

### Fallback: OpenAI Whisper API

```typescript
// Only used if Python whisper is unavailable and OpenAI key exists
const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${apiKey}` },
  body: formData  // file + model: 'whisper-1'
})
```

## Extension Structure Addition

Each channel extension adds a voice handler. Example for ext-telegram:

```
packages/extensions/ext-telegram/src/main/
├── index.ts
├── telegram-bot.ts        # EDIT — detect voice messages, download audio
├── ai-gateway.ts          # No change — receives transcript as text
└── formatters.ts          # No change
```

The `VoiceTranscriber` lives in core since all channels share it:

```
packages/core/src/audio/
├── voice-transcriber.ts   # CREATE — Whisper CLI wrapper + OpenAI fallback
└── __tests__/
    └── voice-transcriber.test.ts
```

## Setup

### 1. Install Whisper

```bash
pip install openai-whisper
```

Or with pipx (isolated):
```bash
pipx install openai-whisper
```

### 2. Install ffmpeg (required by Whisper)

```bash
brew install ffmpeg
```

### 3. Verify

```bash
whisper --help
```

On first voice message, Whisper auto-downloads the `tiny` model (~75MB). Subsequent transcriptions use the cached model.

### 4. (Optional) Use a larger model

For better accuracy on longer messages, set in OpenOrbit settings:

| Setting Key | Default | Options |
|-------------|---------|---------|
| `voice.whisper-model` | `tiny` | `tiny`, `base`, `small`, `medium` |

Model sizes: tiny (~75MB, ~1s), base (~140MB, ~2s), small (~460MB, ~5s), medium (~1.5GB, ~10s).

## Key Considerations

- **First-run download** — Whisper downloads the model on first use. This takes 30-60s depending on network. Subsequent runs use the cached model.
- **CPU only** — Whisper runs on CPU by default on Mac. The `tiny` and `base` models are fast enough for voice messages (<5s transcription for 30s audio).
- **ffmpeg dependency** — Whisper requires ffmpeg for audio decoding. Must be installed separately.
- **Privacy** — all transcription is local. No audio leaves the machine (unless falling back to OpenAI API).
- **Python dependency** — requires Python 3.8+ for the whisper CLI. Not bundled with OpenOrbit.

## Security

- Audio files processed locally (never uploaded unless OpenAI fallback is used)
- Temp files cleaned up after transcription
- Same authorization rules apply — only authorized users can send voice messages
- File size limit prevents abuse (20MB default)

## Success Criteria

- [ ] `VoiceTranscriber.isAvailable()` detects whisper CLI
- [ ] Voice messages on Telegram transcribed and processed as text
- [ ] Voice messages on iMessage transcribed and processed as text
- [ ] Voice messages on WhatsApp transcribed and processed as text
- [ ] Voice messages on Discord transcribed and processed as text
- [ ] Graceful fallback when whisper is not installed (skip with log warning)
- [ ] OpenAI API fallback works when configured
- [ ] Temp files cleaned up after transcription
- [ ] All tests pass
