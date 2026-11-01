---
name: ardesia-sequential-execution
description: "Use when resuming or executing Ardesia Next in a sequential Codex cycle, including incomplete work, task selection or WAITING_CI."
---

# ardesia-sequential-execution

Read AGENTS.md and docs/START_HERE.md, then the adopted docs/recurring-work.md. Load only the complete current task, relevant history decision and scoped instructions. Use the same Git cursor and canonical queue. In schema v2 Codex is coordinator, not a worker waiting for Pro. Check current refs and claims; an inaccessible historical task ID is not global deadlock. Select a bounded consumer and reuse applicable evidence. Use tools/cycle.mjs claim/assign/budget/finish without resetting startedAt. Never alter scheduler, permissions or model during a cycle. Close within 55 minutes with exact source/evidence, publication state and one next step. If tools are missing, do not pretend to execute; keep any safe result recoverable.
