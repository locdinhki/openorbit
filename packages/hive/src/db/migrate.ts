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

    console.log('[db] Schema migration complete')
  } finally {
    await sql.end()
  }
}
