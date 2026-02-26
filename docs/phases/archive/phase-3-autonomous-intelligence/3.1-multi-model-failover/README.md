# 3.1: Multi-Model Failover + API Key Rotation (COMPLETE ✓)

**Effort:** Low | **Status:** Complete

## Background

From [OpenClaw Analysis Section 4E](../../research/openclaw-analysis.md): Multiple API keys with rotation and model failover ensure the automation pipeline never stalls due to a single rate limit or model outage.

## Tasks

### API Key Rotation
- [x] Modify `src/main/ai/claude-service.ts`:
  - Support multiple API keys stored as JSON array in settings: `anthropic_api_keys`
  - On `429 Too Many Requests`: rotate to next key
  - Exponential backoff: 1s, 2s, 4s, 8s, max 30s
  - Track per-key usage counts for load balancing

### Model Failover
- [x] Add fallback logic to `selectModel()`:
  - If Opus fails → retry with Sonnet (and vice versa)
  - If all models fail → queue task for retry
- [x] Add `maxRetries` parameter to `complete()` method

### Usage Tracking
- [x] Add `api_usage` table (new migration):
  - `id`, `timestamp`, `api_key_hash`, `model`, `task_type`
  - `input_tokens`, `output_tokens`, `response_time_ms`, `success`
- [x] Expose via IPC for settings/dashboard display

## Files to Modify

```
src/main/ai/claude-service.ts (key rotation, failover, retries)
src/main/db/database.ts (api_usage migration)
src/main/db/settings-repo.ts (multi-key support)
src/shared/constants.ts (retry constants)
```

## Success Criteria

- [x] A 429 on key A automatically retries with key B
- [x] Opus timeout falls back to Sonnet with reduced token budget
- [x] API usage visible in settings UI
- [x] Backoff prevents hammering the API
