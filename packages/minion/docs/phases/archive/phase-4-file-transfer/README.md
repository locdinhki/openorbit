# Phase 4: File Transfer (R2)

**Theme:** Upload/download large payloads via Cloudflare R2 object storage.

**Effort:** Low | **Depends on:** Phase 3 | **Status:** Skipped

## Why Skipped

Inline results (10MB cap via `maxOutputBytes` in minion config) are sufficient for current use cases. R2 adds operational overhead (bucket setup, presigned URLs, credential distribution) with no immediate benefit. Deferred until a use case requiring >10MB transfers arises.

## What It Would Have Added

- `upload` instruction: minion reads `localPath` → streams to R2 → returns public/presigned URL
- `download` instruction: minion fetches URL → writes to `localPath`
- Cloudflare R2 bucket + API credentials in minion config
- Hive passes R2 URLs in instruction payloads, never file contents

## Re-enable When

- Log aggregation from multiple minions (could be large)
- Screenshot/video capture on a minion
- Large dataset transfer between devices
