# Phase 14: Automation

**Theme:** Close the operational loop — task templates for reusable instructions, webhook triggers for external integration, and event-driven automation for self-healing.

**Effort:** Medium | **Depends on:** Phase 9 (workflows) + Phase 6 (dashboard) | **Status:** Not started

## Why This Phase

Three gaps in the current automation story:

1. **Repetition** — operators run the same commands constantly (check disk, restart nginx, tail log). There's no way to save these as named templates.
2. **External integration** — CI/CD pipelines, monitoring systems, and Stripe webhooks can't trigger hive tasks today without custom code.
3. **Reactivity** — alerts fire and Telegram messages are sent, but the fleet can't fix itself. Auto-remediation requires a human in the loop.

This phase addresses all three.

---

## Part A: Task Templates

Named, saved instructions that can be dispatched with one click or one AI call.

### DB Schema

```sql
CREATE TABLE task_templates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  device_id   TEXT REFERENCES devices(id) ON DELETE SET NULL,  -- null = pick at run time
  instruction JSONB NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### REST Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/templates` | List all templates |
| POST | `/api/templates` | Create a template |
| DELETE | `/api/templates/:id` | Delete a template |
| POST | `/api/templates/:id/run` | Run a template (`body: { deviceId? }`) |

### Dashboard

- Templates page (`/templates`) — table with name, description, instruction type, target device
- "Save as template" button on the TaskNew dispatch form
- Run button per row — shows device picker if `device_id` is null
- Searchable by name

### AI Tools

| Tool | Description |
|------|-------------|
| `list_templates` | List saved task templates |
| `run_template` | Execute a template by name, optionally override device |

---

## Part B: Webhook Receiver

Unique URLs that external services call (HTTP POST) to trigger a configured workflow or template.

### DB Schema

```sql
CREATE TABLE webhooks (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  token      TEXT UNIQUE NOT NULL,  -- random secret in URL
  action     TEXT NOT NULL CHECK(action IN ('task', 'workflow', 'template')),
  action_id  TEXT NOT NULL,
  device_id  TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE webhook_calls (
  id         TEXT PRIMARY KEY,
  webhook_id TEXT REFERENCES webhooks(id),
  called_at  TEXT NOT NULL,
  payload    JSONB,
  result_id  TEXT  -- task or workflow run ID
);
```

### REST Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/webhooks/:token` | None (token in URL) | Trigger webhook |
| GET | `/api/webhooks` | Controller key | List webhooks |
| POST | `/api/webhooks` | Controller key | Create webhook |
| DELETE | `/api/webhooks/:id` | Controller key | Delete webhook |
| GET | `/api/webhooks/:id/calls` | Controller key | Invocation history |

### Dashboard

- Webhooks page (`/webhooks`) — list with copy-URL button, invocation history, delete
- Create form: name, action type (template/workflow), target

---

## Part C: Event-Driven Triggers

Condition → action rules evaluated on every hive event. Closes the alert → remediation loop.

### Trigger Conditions

| Condition | Parameters |
|-----------|-----------|
| `alert.fired` | `ruleId?` (all rules or one specific) |
| `alert.resolved` | `ruleId?` |
| `device.online` | `deviceId?` |
| `device.offline` | `deviceId?` |
| `metric.threshold` | `metric`, `op`, `value`, `windowS` (sustained) |

### Trigger Actions

| Action | Parameters |
|--------|-----------|
| `run_workflow` | `workflowId`, `deviceId?` |
| `run_template` | `templateId`, `deviceId?` |
| `exec_command` | `deviceId`, `command` |
| `send_telegram` | `message` (supports `${deviceName}`, `${metric}`) |

### DB Schema

```sql
CREATE TABLE triggers (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  condition        TEXT NOT NULL,
  condition_params JSONB,
  action           TEXT NOT NULL,
  action_params    JSONB NOT NULL,
  cooldown_s       INTEGER DEFAULT 300,  -- prevents storm-firing
  last_fired_at    TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE trigger_runs (
  id             TEXT PRIMARY KEY,
  trigger_id     TEXT REFERENCES triggers(id),
  fired_at       TEXT NOT NULL,
  condition_data JSONB,
  result_id      TEXT
);
```

### Evaluation Points

```
ws-server.ts   device auth success    → device.online
ws-server.ts   heartbeat timeout      → device.offline
ws-server.ts   heartbeat metrics      → metric.threshold
alert-engine   alert fires            → alert.fired
alert-engine   alert resolves         → alert.resolved
```

### REST Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/triggers` | List triggers |
| POST | `/api/triggers` | Create trigger |
| PATCH | `/api/triggers/:id` | Enable/disable |
| DELETE | `/api/triggers/:id` | Delete trigger |
| GET | `/api/triggers/:id/runs` | Fire history |

### Dashboard

- Triggers page (`/triggers`) — condition + action summary per row, enable/disable toggle
- Create form: condition selector with dynamic params, action selector with dynamic params, cooldown
- Expandable fire history per trigger row

### AI Tools

| Tool | Description |
|------|-------------|
| `list_triggers` | List configured triggers with last fired time |
| `create_trigger` | Create a condition → action trigger |

---

## Success Criteria

- [ ] Templates save from dispatch form; one-click run works
- [ ] `POST /webhooks/:token` triggers the configured action and logs the call
- [ ] Alert fires → linked workflow starts automatically within 5s
- [ ] Device comes online → configured workflow runs on that device
- [ ] Cooldown prevents repeated trigger firing during a metric storm
- [ ] AI can list/run templates and create triggers via tool calls
