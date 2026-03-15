# openclaw-optimizer

OpenClaw optimizer toolkit. Current core feature is `skill-stats`: it analyzes skill usage from session logs and generates optimization suggestions. Read-only: it does not modify OpenClaw config or skill files.

## Data sources

- **Session logs**: OpenClaw stores conversation transcripts under `~/.clawdbot/agents/<agentId>/sessions/` as `<session-id>.jsonl`. Each line is a JSON object; messages with `message.content[].type === "toolCall"` are counted. If the runtime writes `skillName` on tool calls (or in arguments), that is used; otherwise tool names are mapped to skills via scanned skill dirs.
- **Skills**: Scanned from `./skills` and `~/.openclaw/skills` by default. Each skill is a directory with `SKILL.md` (YAML frontmatter: `name`, `description`) and optional `tools.json` (tool names). The CLI builds a **tool name → skill name** map from these to attribute calls.

See [OpenClaw Skills](https://docs.openclaw.ai/skills) and the session-logs skill for format details.

## Install

### One-click install script (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/linsheng9731/openclaw-optimizer/main/scripts/install.sh | bash
```

The script will:

- check Node.js version (`>=18`)
- detect the latest GitHub Release
- install the `.tgz` release artifact globally via npm

After install:

```bash
openclaw-optimizer --help
```

If you have cloned this repo and want local development setup:

```bash
npm run install:dev
```

For release publishing, generate upload artifact with:

```bash
npm run pack:release
```

You can also run it through npm:

```bash
npm run install:one-click
```

## Usage

```bash
# Stats (default): show usage by skill, unused skills, unknown tools
pnpm optimizer

# With date range and JSON
pnpm optimizer --since 2026-01-01 --until 2026-01-31 --by-day --json

# Optimization suggestions (unused/low-use, token estimate, high-call warning)
pnpm optimizer suggest

# Suggest: treat skills with < 5 calls as low-usage
pnpm optimizer suggest --min-calls 5 --output json
```

### Options

| Option | Description |
|--------|-------------|
| `--sessions-dir <path>` | Base dir for agents/sessions (default: `~/.clawdbot/agents`) |
| `--skills-dirs <path>` | Comma-separated skill dirs (default: `./skills,~/.openclaw/skills`) |
| `--since <YYYY-MM-DD>` | Only include calls on or after this date |
| `--until <YYYY-MM-DD>` | Only include calls on or before this date |
| `--agent <id>` | Only include sessions for this agent id |
| `--by-day` | Include per-day breakdown (stats) |
| `--by-session` | Include per-session breakdown (stats) |
| `--json` | Machine-readable JSON output |
| `--min-calls <n>` | For suggest: treat skills with fewer than n calls as low-usage |

**Environment**

- `OPENCLAW_SESSIONS_DIR` – overrides default sessions base.

## Output examples

**Stats (text):**

```
OpenClaw Skill Usage Stats
==========================
Sessions base: /Users/you/.clawdbot/agents
Total tool calls: 42

By skill:
  feishu-doc                12  28.6%  2026-01-15T10:00:00Z  2026-01-15T12:00:00Z
  session-logs               8  19.0%  ...
  __unknown__                5  11.9%  ...

Unused (installed but 0 calls):
  skill-vetter, deploy-to-vercel
```

**Suggest (text):**

- **Unused or low-usage skills** – consider `skills.entries.<name>.enabled: false` in `~/.openclaw/openclaw.json`.
- **Skill prompt token estimate** – approximate chars/tokens for the current skills list; disabling unused skills reduces this.
- **Skills with very high call counts** – if they trigger too often, narrow the SKILL.md description.
- **Tool calls not mapped to any skill** – built-in or bundled tools not in `--skills-dirs`.

## Tests

```bash
pnpm test
```

Uses fixtures under `tests/fixtures/`: sample session JSONL and a fake skill dir.

## License

MIT
