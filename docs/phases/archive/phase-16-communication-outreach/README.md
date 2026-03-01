# Phase 16: Communication & Outreach

**Theme:** Foundational outbound communication skills (Email SMTP, SMS/MMS) plus a VoIP extension for click-to-call with recording and transcription. These channels are prerequisites for invoicing (Phase 18), marketing (Phase 20), and calendar reminders (Phase 20).

**Effort:** High | **Depends on:** Phase 12 (Skill System) | **Status:** Complete

## Why This Phase

Nearly every business workflow ends with "...and notify the customer." Email and SMS are the two universal outbound channels. Adding them as built-in skills means any extension can compose them — invoice delivery, appointment reminders, lead alerts, report distribution. ext-voip adds phone calls as a third channel with AI transcription leveraging the existing AI provider registry.

## Components

### 16.1: Email (SMTP) Skill

Built-in tool skill using `nodemailer` with configurable SMTP (Gmail, Outlook, custom).

- HTML template engine with `{{merge}}` fields (supports nested fields like `{{contact.firstName}}`)
- Attachment support (base64 content or file paths)
- CC/BCC support
- Plain text fallback auto-generated from HTML
- Input validation with email format checking
- Skill id: `email-smtp`, category: `communication`

**Settings:**
- `email.smtp-host` - SMTP server hostname
- `email.smtp-port` - SMTP port (default: 587)
- `email.smtp-user` - SMTP username
- `email.smtp-pass` - SMTP password
- `email.smtp-from` - Default sender email
- `email.smtp-secure` - Use TLS (true/false)

**Implementation:** `packages/core/src/skills/builtin/email-smtp-skill.ts`

### 16.2: SMS / MMS Skill

Built-in tool skill using Twilio API.

- Template system with `{{merge}}` fields
- Automatic E.164 phone number normalization (handles common US formats)
- MMS media attachment support via URLs
- Message length validation (max 1600 chars)
- Twilio error code handling
- Skill id: `sms-mms`, category: `communication`
- **Note:** ext-ghl already has SMS via GHL's API — this is for standalone use outside GHL

**Settings:**
- `twilio.account-sid` - Twilio Account SID
- `twilio.auth-token` - Twilio Auth Token
- `twilio.phone-number` - Default Twilio phone number

**Implementation:** `packages/core/src/skills/builtin/sms-mms-skill.ts`

### 16.3: ext-voip — Call Tracking & VoIP

Full extension for click-to-call from any contact record.

- Twilio Voice API for outbound calls
- Call recording with automatic start option
- AI transcription via `voice-transcribe` skill
- Call log with contact linking and outcome tracking
- Call analytics (duration, success rate, per-contact history)
- Scheduler tasks for status sync and auto-transcription
- **IPC channels:** 20 (settings, calls, recordings, transcription, analytics)
- **DB tables:** `voip_calls`, `voip_recordings`

**Settings:**
- `voip.twilio-account-sid` - Twilio Account SID
- `voip.twilio-auth-token` - Twilio Auth Token
- `voip.twilio-phone-number` - Twilio phone number (E.164)
- `voip.recording-enabled` - Auto-record calls (boolean)
- `voip.transcription-enabled` - Auto-transcribe recordings (boolean)

**Scheduler Tasks:**
- `voip-sync-calls` - Sync active call statuses with Twilio
- `voip-auto-transcribe` - Auto-transcribe completed recordings

**Implementation:** `packages/extensions/ext-voip/`

## New Dependencies

| Package | Purpose |
|---------|---------|
| `nodemailer` | SMTP email sending |
| `@types/nodemailer` | TypeScript types for nodemailer |
| `twilio` | SMS/MMS + Voice API |

## File Structure

```
packages/core/src/skills/builtin/
├── email-smtp-skill.ts      # 16.1 Email SMTP skill
└── sms-mms-skill.ts         # 16.2 SMS/MMS skill

packages/extensions/ext-voip/
├── package.json
└── src/
    ├── ipc-channels.ts      # IPC channel constants
    ├── ipc-schemas.ts       # Zod validation schemas
    ├── main/
    │   ├── index.ts         # Extension entry point
    │   ├── ipc-handlers.ts  # IPC handler registration
    │   ├── voip-service.ts  # Twilio Voice integration
    │   └── db/
    │       ├── migrations.ts   # DB schema migrations
    │       └── calls-repo.ts   # Call & recording repository
    └── renderer/
        └── index.ts         # Renderer entry point
```

## Configuration Updates

- `electron.vite.config.ts` - Added `@openorbit/ext-voip` alias
- `tsconfig.node.json` - Added path mapping for ext-voip
- `src/main/index.ts` - Registered skills and extension
- `packages/core/src/skills/skill-catalog.ts` - Updated email-smtp and sms-mms to tool type

## After Phase 16, OpenOrbit Is...

A platform with three outbound communication channels (email, SMS, phone) that any extension can compose — enabling automated invoice delivery, appointment reminders, lead notifications, and AI-transcribed call logs.
