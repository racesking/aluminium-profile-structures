# AGENTS.md

Instructions for any AI coding agent or tool working in this repository (Claude Code, Codex, Cursor, Copilot, Gemini and others).

## Read first, in this order

1. **`PROJECT_MEMORY.md`**: product decisions, current state, what's next, known issues. The project's persistent memory.
2. **`CLAUDE.md`**: architecture, data model, invariants and gotchas. It applies to every agent, not just Claude.
3. **`tasks/plan.md` + `tasks/todo.md`**: the active roadmap with acceptance criteria.

## Mandatory rule: keep the memory current

**Every change you land must update `PROJECT_MEMORY.md` in the same commit.** That means a change-log line, corrected "Current state" lines, new decisions (append-only), ticked roadmap tasks and known issues. If architecture or invariants change, update `CLAUDE.md` too. A change without a memory update is not done.

## Definition of done

- `npm run typecheck`, `npm run lint`, `npm run test` and `npm run build` all pass. CI gates deploys on them.
- The cut list stays correct. Any change to cut lengths, parts or the optimizer needs tests in `src/core/`.
- `PROJECT_MEMORY.md` is updated, then you commit with a descriptive message. Pushing to `main` deploys to production.
