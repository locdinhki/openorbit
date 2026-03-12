# Phase 16: Platform & Access

**Theme:** Harden the platform for shared use — user accounts with roles, a tamper-evident audit log, and a terminal CLI for operators who live in the shell.

**Effort:** Medium | **Depends on:** Phase 6 (dashboard auth) | **Status:** Not started

## Why This Phase

The current single-password auth works for personal use but breaks down when multiple people need access. A junior operator shouldn't be able to delete devices. A Slack bot's read-only access shouldn't carry full dispatch permissions. The audit log answers "who did what and when" — essential once more than one person touches the system. The CLI gives power users a faster interface than the browser.

---

## Part A: Multi-User + Roles

Replace the single `CONTROLLER_API_KEY` with JWT-authenticated user accounts.

### Roles

| Role | Permissions |
|------|------------|
| `admin` | All actions: create users, manage devices, dispatch tasks, modify alert rules |
| `operator` | Dispatch tasks, create schedules/workflows/triggers, manage alert rules |
| `viewer` | Read-only: view devices, tasks, metrics, alerts — no write actions |

### DB Schema

```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,   -- bcrypt
  role          TEXT NOT NULL CHECK(role IN ('admin', 'operator', 'viewer')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);
```

### Auth Flow

- `POST /api/auth/login` — `{ username, password }` → returns JWT (signed with `JWT_SECRET`, 24h expiry)
- All existing `requireAuth` middleware updated to verify JWT and set `req.user`
- `requireRole('admin')` and `requireRole('operator')` guards on write endpoints
- Dashboard login page: add username field alongside password field
- Machine-to-machine (ext-hive, hive-ctl): `CONTROLLER_API_KEY` env var still accepted as a bearer token for backwards compatibility

### Bootstrap

On first boot with no users in DB, create a default admin from env vars:
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<set this>
```

### REST Endpoints

| Method | Endpoint | Role | Purpose |
|--------|----------|------|---------|
| POST | `/api/auth/login` | None | Authenticate, get JWT |
| GET | `/api/users` | admin | List users |
| POST | `/api/users` | admin | Create user |
| PATCH | `/api/users/:id` | admin | Update role or password |
| DELETE | `/api/users/:id` | admin | Delete user |

### Dashboard

- Login page: username + password fields
- Settings → Users (admin only): create/edit/delete users, role badge
- Nav header: "Logged in as X" + logout button

---

## Part B: Audit Log

Every state-changing API call is recorded with user, action, affected resource, and timestamp.

### DB Schema

```sql
CREATE TABLE audit_log (
  id         TEXT PRIMARY KEY,
  user_id    TEXT REFERENCES users(id),
  action     TEXT NOT NULL,   -- 'task.create', 'device.delete', 'schedule.update'
  target_id  TEXT,
  payload    JSONB,           -- request body snapshot (sensitive fields redacted)
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_user    ON audit_log(user_id, created_at DESC);
```

### Implementation

An `audit(action)` middleware wraps route handlers:

```typescript
function audit(action: string) {
  return (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        store.createAuditEntry({
          userId: req.user?.id,
          action,
          targetId: req.params.id,
          payload: redact(req.body),
          ip: req.ip
        })
      }
    })
    next()
  }
}

// Usage:
app.post('/api/tasks', requireAuth, requireRole('operator'), audit('task.create'), handler)
```

### REST Endpoints

| Method | Endpoint | Role | Purpose |
|--------|----------|------|---------|
| GET | `/api/audit-log` | admin | Paginated log (filterable by user, action, date range) |

### Dashboard

- Audit Log page (`/audit-log`, admin only) — action, user, target, IP, timestamp
- Filterable by user and action type
- Linked target IDs navigate to the relevant task/device/schedule detail page

---

## Part C: hive-ctl CLI

A terminal CLI for operators who prefer the shell over the browser.

### Installation

```bash
npm install -g hive-ctl
# or: npx hive-ctl <command>
```

Config in `~/.hive-ctl/config.json` or env vars `HIVE_URL` + `HIVE_API_KEY`.

### Commands

```bash
# Setup
hive-ctl config set-url https://hive.openorbit.ai
hive-ctl config set-key <api-key>

# Devices
hive-ctl ps                           # list all devices
hive-ctl ps --online                  # online only

# Tasks
hive-ctl exec <device> <command>      # run command, wait, print stdout
hive-ctl tasks                        # recent tasks
hive-ctl tasks --device <id> --status failed

# Alerts
hive-ctl alerts                       # active alerts
hive-ctl alerts --all                 # include resolved

# Updates
hive-ctl update <device>              # update one device
hive-ctl update --all                 # update all outdated devices
```

`hive-ctl exec` polls the task until completion and prints stdout line-by-line.

### Package Structure

```
packages/hive-ctl/
  package.json      (bin: { "hive-ctl": "./dist/index.js" })
  src/
    index.ts        (commander.js entry)
    commands/       (ps, exec, tasks, alerts, update)
    config.ts       (read/write ~/.hive-ctl/config.json)
    api.ts          (typed fetch wrapper)
```

Uses `commander` for arg parsing, `chalk` for color, `ora` for spinners.

---

## Success Criteria

- [ ] Viewer cannot POST to `/api/tasks` (receives 403)
- [ ] Every task dispatch, schedule create, and device delete appears in audit log
- [ ] Admin can create an operator account from the dashboard Users page
- [ ] JWT expiry forces re-login after 24h; existing sessions invalidated on password change
- [ ] Machine-to-machine `CONTROLLER_API_KEY` still works for ext-hive and hive-ctl
- [ ] `hive-ctl ps` lists devices; `hive-ctl exec <device> <command>` returns stdout
- [ ] Audit log page shows who dispatched each task and from which IP
