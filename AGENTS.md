# AGENTS.md
Guidance for agentic coding workflows in this repository.
Scope: `/Volumes/storage/github/openclaw-optimizer` (whole repo).

## Project overview
- Language/runtime: TypeScript on Node.js 18+.
- Modules: ESM (`"type": "module"`).
- Compiler: TypeScript (`strict: true`).
- Test framework: Vitest (`vitest.config.ts`, test root is `tests/`).
- Package manager: pnpm preferred (npm fallback).
- Main directories: `src/`, `tests/`, `scripts/`, `dist/`.

## Command reference
Run from repo root.

### Install
```bash
pnpm install
# fallback
npm install
```

### Build
```bash
pnpm build
# package.json script:
# ./node_modules/typescript/bin/tsc -p .
```

### Typecheck
No dedicated script exists. Use:
```bash
pnpm exec tsc -p . --noEmit
```

### Lint/format
- No lint script in `package.json`.
- No ESLint/Prettier config detected.
- Preserve current formatting conventions.

### Test (all)
```bash
pnpm test
```

### Test (watch)
```bash
pnpm test:watch
```

### Test (single file)
```bash
pnpm exec vitest run tests/parser.test.ts
pnpm test -- tests/parser.test.ts
node --experimental-vm-modules node_modules/vitest/vitest.mjs run tests/parser.test.ts
```

### Test (single test name/pattern)
```bash
pnpm exec vitest run -t "parses session file and extracts tool calls"
pnpm test -- -t "aggregateStats"
node --experimental-vm-modules node_modules/vitest/vitest.mjs run -t "suggest"
```

### CLI smoke checks
```bash
pnpm optimizer --help
pnpm optimizer stats --json
pnpm optimizer suggest --output json
```

## Code style (derived from repo)
### Imports
- Use ESM import/export syntax.
- Use `node:` prefix for Node built-ins (`node:path`, `node:fs`, `node:url`).
- Use explicit `.js` extension for internal relative imports.
- Use `import type` for type-only imports.
- Import order used by repo: built-ins → third-party → internal.

### Formatting
- 2-space indentation.
- Double quotes.
- Semicolons.
- Keep long expressions wrapped for readability.
- Avoid unrelated formatting churn in functional patches.

### Types and contracts
- Respect strict typing; avoid `any`.
- Shared contracts belong in `src/types.ts`.
- Keep exported function signatures explicit and stable.
- Use narrow unions where applicable (e.g. `"info" | "warn" | "tip"`).

### Naming
- `camelCase`: variables/functions.
- `PascalCase`: interfaces/classes/types.
- `UPPER_SNAKE_CASE`: constants.
- Filenames: concise lowercase domain names (`parser.ts`, `stats.ts`).

### Error handling and control flow
- Validate CLI args early; use `CliUsageError` for usage mistakes.
- Top-level CLI catch prints error and exits non-zero.
- In tolerant parsing paths, ignore malformed records instead of crashing.
- Empty `catch {}` is only acceptable for intentionally ignored parse failures.
- Prefer guard clauses / early returns.

### Data structures and module boundaries
- Use `Map`/`Set` for aggregation/de-duplication.
- Convert `Map` to plain objects at output boundaries only.
- Keep responsibilities separated:
  - `parser.ts`: session discovery/parsing
  - `skills.ts`: skill scanning and tool→skill map
  - `stats.ts`: aggregation
  - `suggest.ts`: recommendation logic
  - `cli.ts`: argument parsing and output rendering
  - `index.ts`: public exports

### Test conventions
- Vitest style: `describe`, `it`, `expect`.
- Test files under `tests/*.test.ts`.
- Fixtures under `tests/fixtures/`.
- For ESM-safe fixture paths use `fileURLToPath(import.meta.url)` + `dirname(...)`.
- Prefer exact assertions (`toBe`, `toContain`, `toBeDefined`).

## Agent checklist for code changes
1. Run targeted tests (single file or `-t`).
2. Run full tests: `pnpm test`.
3. Run typecheck: `pnpm exec tsc -p . --noEmit`.
4. Run build: `pnpm build`.
5. Run CLI smoke checks if CLI behavior changed.

## Cursor/Copilot rule files
Searched and not found in this repository:
- `.cursor/rules/`
- `.cursorrules`
- `.github/copilot-instructions.md`
If added later, merge their guidance into this file.

## Guardrails
- Do not add new tools/dependencies unless explicitly requested.
- Do not alter CLI flags/help text unless required by task.
- Keep patches minimal and architecture-consistent.
- Do not silently change JSON output schema.
