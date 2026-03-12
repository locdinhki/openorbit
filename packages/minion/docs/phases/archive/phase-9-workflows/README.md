# Phase 9: Task Chains / Workflows

**Theme:** Sequential multi-step task execution with conditional branching and variable passing between steps.

**Effort:** Moderate | **Depends on:** Phase 8 | **Status:** Complete

## Why This Phase

Complex automations require chaining multiple instructions: install a dependency, verify it, run a task that depends on it, handle failure differently than success. Single-task dispatch can't express this. Workflows let the AI (or the user) define a DAG of steps that execute in order on the hive.

## Tasks

- [x] Workflow definition: `WorkflowStep` type — `name`, `deviceId`, `instruction`, `onSuccess` (step index), `onFailure` (step index), `passOutputAs` (variable name)
- [x] `workflows`, `workflow_runs`, `workflow_step_runs` tables (V3 migration)
- [x] `WorkflowRunner` in `packages/hive/src/workflow-runner.ts` — sequential async executor, polls task completion every 2s, substitutes `${VAR}` in instructions
- [x] Conditional branching: `onSuccess` / `onFailure` step index overrides (default: next step / abort)
- [x] stdout passing between steps via `passOutputAs` variable name
- [x] REST endpoints: `GET/POST/DELETE /api/workflows`, `GET /api/workflows/:id/runs`, `POST /api/workflows/:id/run`, `GET /api/workflow-runs/:id`
- [x] Dashboard: Workflows list with inline Run button, WorkflowNew step builder, WorkflowRunDetail with live polling + step output
- [x] AI agent tools: `list_workflows`, `create_workflow`, `run_workflow`, `get_workflow_status` (15 total tools)
- [x] Build verified: main 978kB, renderer 1366kB; dashboard 277kB JS + 16kB CSS

## Variable Substitution

Steps can reference output from previous steps using `${VAR}` in any string field of the instruction:

```json
{ "type": "exec", "command": "echo ${PREV_OUTPUT}" }
```

The variable is populated by the previous step's `passOutputAs` result (stdout for `exec`, content for `read`).

## AI Tools (4 new, 15 total)

| Tool | Description |
|------|-------------|
| `list_workflows` | List all workflow definitions |
| `create_workflow` | Define a new multi-step workflow |
| `run_workflow` | Execute a workflow, returns run ID |
| `get_workflow_status` | Poll a workflow run for step status |

## Success Criteria

- [x] Multi-step workflow executes steps in order
- [x] `onFailure` branching skips remaining steps on error
- [x] `${VAR}` substitution works across step boundaries
- [x] WorkflowRunDetail polls live and shows per-step status + output
- [x] AI can create a workflow with conditional logic and run it
