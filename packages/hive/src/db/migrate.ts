import postgres from 'postgres'

/**
 * Push schema to database using raw SQL.
 * We use raw DDL instead of drizzle-kit push for simplicity and zero config.
 */
export async function migrateDb(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl)

  try {
    await sql`
      DO $$ BEGIN
        CREATE TYPE device_status AS ENUM ('online', 'offline', 'busy');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `
    await sql`
      DO $$ BEGIN
        CREATE TYPE device_type AS ENUM ('minion', 'controller');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `
    await sql`
      DO $$ BEGIN
        CREATE TYPE task_status AS ENUM ('queued', 'dispatched', 'running', 'completed', 'failed', 'timeout');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `
    await sql`
      DO $$ BEGIN
        CREATE TYPE task_priority AS ENUM ('low', 'normal', 'high', 'critical');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `
    await sql`
      DO $$ BEGIN
        CREATE TYPE result_status AS ENUM ('success', 'error', 'timeout');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `

    await sql`
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        hardware_id TEXT UNIQUE,
        api_key_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        type device_type NOT NULL DEFAULT 'minion',
        capabilities JSONB DEFAULT '[]',
        location_tag TEXT,
        status device_status NOT NULL DEFAULT 'offline',
        last_seen_at TIMESTAMPTZ,
        ip_address TEXT,
        hardware_info JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `

    await sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        created_by TEXT REFERENCES devices(id),
        target_device TEXT REFERENCES devices(id),
        priority task_priority NOT NULL DEFAULT 'normal',
        status task_status NOT NULL DEFAULT 'queued',
        instruction JSONB NOT NULL,
        dispatched_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `

    await sql`
      CREATE TABLE IF NOT EXISTS task_results (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id),
        device_id TEXT NOT NULL REFERENCES devices(id),
        status result_status NOT NULL,
        result JSONB,
        error TEXT,
        duration_ms TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `

    // V2: Schedules
    await sql`
      CREATE TABLE IF NOT EXISTS schedules (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL REFERENCES devices(id),
        name TEXT NOT NULL,
        instruction JSONB NOT NULL,
        cron_expression TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT true,
        last_run_at TIMESTAMPTZ,
        next_run_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `

    // V3: Workflows
    await sql`
      DO $$ BEGIN
        CREATE TYPE workflow_run_status AS ENUM ('pending', 'running', 'completed', 'failed');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `

    await sql`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        steps JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `

    await sql`
      CREATE TABLE IF NOT EXISTS workflow_runs (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL REFERENCES workflows(id),
        status workflow_run_status NOT NULL DEFAULT 'pending',
        current_step INTEGER NOT NULL DEFAULT 0,
        context JSONB DEFAULT '{}',
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `

    await sql`
      CREATE TABLE IF NOT EXISTS workflow_step_runs (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES workflow_runs(id),
        step_index INTEGER NOT NULL,
        task_id TEXT REFERENCES tasks(id),
        status workflow_run_status NOT NULL DEFAULT 'pending',
        output JSONB,
        error TEXT,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ
      );
    `

    // V4: Device Groups
    await sql`
      CREATE TABLE IF NOT EXISTS device_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        tag_filter TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `

    // V5: Monitoring + Alerts
    await sql`
      CREATE TABLE IF NOT EXISTS device_metrics (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL REFERENCES devices(id),
        recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        cpu_percent REAL,
        mem_percent REAL,
        mem_used_mb INTEGER,
        mem_total_mb INTEGER
      );
    `
    await sql`
      CREATE INDEX IF NOT EXISTS device_metrics_device_recorded
        ON device_metrics(device_id, recorded_at DESC);
    `
    await sql`
      CREATE TABLE IF NOT EXISTS alert_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        device_id TEXT REFERENCES devices(id),
        metric TEXT NOT NULL,
        threshold REAL NOT NULL DEFAULT 90,
        enabled BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `
    await sql`
      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        rule_id TEXT NOT NULL REFERENCES alert_rules(id),
        device_id TEXT NOT NULL REFERENCES devices(id),
        triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        resolved_at TIMESTAMPTZ,
        notified BOOLEAN NOT NULL DEFAULT false,
        message TEXT
      );
    `

    // V6: Minion auto-update — version tracking
    await sql`
      ALTER TABLE devices ADD COLUMN IF NOT EXISTS minion_version TEXT;
    `

    // V7: Automation — task templates, webhooks, event-driven triggers
    await sql`
      CREATE TABLE IF NOT EXISTS task_templates (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT,
        device_id   TEXT REFERENCES devices(id) ON DELETE SET NULL,
        instruction JSONB NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `

    await sql`
      CREATE TABLE IF NOT EXISTS webhooks (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        token      TEXT UNIQUE NOT NULL,
        action     TEXT NOT NULL CHECK(action IN ('task', 'workflow', 'template')),
        action_id  TEXT NOT NULL,
        device_id  TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `

    await sql`
      CREATE TABLE IF NOT EXISTS webhook_calls (
        id         TEXT PRIMARY KEY,
        webhook_id TEXT REFERENCES webhooks(id) ON DELETE CASCADE,
        called_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        payload    JSONB,
        result_id  TEXT
      );
    `

    await sql`
      CREATE TABLE IF NOT EXISTS triggers (
        id               TEXT PRIMARY KEY,
        name             TEXT NOT NULL,
        enabled          BOOLEAN NOT NULL DEFAULT true,
        condition        TEXT NOT NULL,
        condition_params JSONB,
        action           TEXT NOT NULL,
        action_params    JSONB NOT NULL,
        cooldown_s       INTEGER DEFAULT 300,
        last_fired_at    TIMESTAMPTZ,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `

    await sql`
      CREATE TABLE IF NOT EXISTS trigger_runs (
        id             TEXT PRIMARY KEY,
        trigger_id     TEXT REFERENCES triggers(id) ON DELETE CASCADE,
        fired_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
        condition_data JSONB,
        result_id      TEXT
      );
    `

    // V8: Observability — health checks, health check results, fleet reports
    await sql`
      CREATE TABLE IF NOT EXISTS health_checks (
        id              TEXT PRIMARY KEY,
        device_id       TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        name            TEXT NOT NULL,
        type            TEXT NOT NULL CHECK(type IN ('http', 'command')),
        url             TEXT,
        expected_status INTEGER DEFAULT 200,
        expected_body   TEXT,
        command         TEXT,
        expected_exit   INTEGER DEFAULT 0,
        run_from        TEXT NOT NULL DEFAULT 'device' CHECK(run_from IN ('hive', 'device')),
        interval_s      INTEGER NOT NULL DEFAULT 60,
        timeout_s       INTEGER NOT NULL DEFAULT 10,
        enabled         BOOLEAN NOT NULL DEFAULT true,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `

    await sql`
      CREATE TABLE IF NOT EXISTS health_check_results (
        id          TEXT PRIMARY KEY,
        check_id    TEXT NOT NULL REFERENCES health_checks(id) ON DELETE CASCADE,
        status      TEXT NOT NULL CHECK(status IN ('pass', 'fail')),
        duration_ms INTEGER,
        error       TEXT,
        checked_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_hcr_check_time
        ON health_check_results(check_id, checked_at DESC);
    `

    await sql`
      CREATE TABLE IF NOT EXISTS fleet_reports (
        id            TEXT PRIMARY KEY,
        generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        content       TEXT NOT NULL,
        period_start  TIMESTAMPTZ NOT NULL,
        period_end    TIMESTAMPTZ NOT NULL
      );
    `

    // V9: Platform & Access — users + audit log
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        username      TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL CHECK(role IN ('admin', 'operator', 'viewer')),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_login_at TIMESTAMPTZ
      );
    `

    await sql`
      CREATE TABLE IF NOT EXISTS audit_log (
        id         TEXT PRIMARY KEY,
        user_id    TEXT REFERENCES users(id),
        action     TEXT NOT NULL,
        target_id  TEXT,
        payload    JSONB,
        ip_address TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id, created_at DESC);
    `

    console.log('[db] Schema migration complete')
  } finally {
    await sql.end()
  }
}
