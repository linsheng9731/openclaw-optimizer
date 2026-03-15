#!/usr/bin/env node
import { join } from "node:path";
import { loadAllToolCalls, getDefaultSessionsBase } from "./parser.js";
import { buildToolToSkillMap, getDefaultSkillsDir } from "./skills.js";
import { aggregateStats } from "./stats.js";
import { suggest } from "./suggest.js";

const SUBCOMMANDS = new Set(["stats", "suggest", "help"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

class CliUsageError extends Error {}

function getArg(argv: string[], name: string, short?: string): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === `--${name}` || (short && argv[i] === short)) {
      if (i + 1 < argv.length && !argv[i + 1].startsWith("-")) return argv[i + 1];
      return "";
    }
  }
  return undefined;
}

function hasFlag(argv: string[], name: string, short?: string): boolean {
  return argv.includes(`--${name}`) || (!!short && argv.includes(short));
}

function readValueArg(argv: string[], name: string, short?: string): string | undefined {
  const value = getArg(argv, name, short);
  if (value === "") {
    throw new CliUsageError(`Missing value for --${name}`);
  }
  return value;
}

function parseDateArg(value: string | undefined, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (!DATE_RE.test(value)) {
    throw new CliUsageError(`Invalid --${name}: expected YYYY-MM-DD`);
  }
  return value;
}

function parseSubcommand(raw: string[]): { sub: string; argv: string[] } {
  if (raw[0] === "help" || raw.includes("--help") || raw.includes("-h")) {
    return { sub: "help", argv: [] };
  }
  if (!raw[0] || raw[0].startsWith("-")) {
    return { sub: "stats", argv: raw };
  }
  if (!SUBCOMMANDS.has(raw[0])) {
    throw new CliUsageError(`Unknown subcommand: ${raw[0]}`);
  }
  return { sub: raw[0], argv: raw.slice(1) };
}

function parseCommonArgs(argv: string[]): {
  sessionsBase: string;
  skillsDirs: string[];
  since?: string;
  until?: string;
  agentId?: string;
} {
  const sessionsBase = resolveSessionsDir(argv);
  const skillsDirs = resolveSkillsDirs(argv);
  const since = parseDateArg(readValueArg(argv, "since"), "since");
  const until = parseDateArg(readValueArg(argv, "until"), "until");
  const agentId = readValueArg(argv, "agent");
  if (since && until && since > until) {
    throw new CliUsageError("Invalid date range: --since must be <= --until");
  }
  return { sessionsBase, skillsDirs, since, until, agentId };
}

function main(): void {
  try {
    const raw = process.argv.slice(2);
    const { sub, argv } = parseSubcommand(raw);

    if (sub === "suggest") {
      runSuggest(argv);
      return;
    }
    if (sub === "stats") {
      runStats(argv);
      return;
    }
    if (sub === "help") {
      printHelp();
      return;
    }
    throw new CliUsageError(`Unknown subcommand: ${sub}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    if (err instanceof CliUsageError) {
      console.log("");
      printHelp();
    }
    process.exit(1);
  }
}

function resolveSessionsDir(argv: string[]): string {
  const env = process.env.OPENCLAW_SESSIONS_DIR;
  if (env) return env;
  const arg = readValueArg(argv, "sessions-dir");
  if (arg !== undefined) return arg;
  return getDefaultSessionsBase();
}

function resolveSkillsDirs(argv: string[]): string[] {
  const arg = readValueArg(argv, "skills-dirs");
  if (arg !== undefined) return arg.split(",").map((s) => s.trim()).filter(Boolean);
  const defaultDir = getDefaultSkillsDir();
  const cwdSkills = join(process.cwd(), "skills");
  return [cwdSkills, defaultDir].filter((d) => d);
}

function runStats(argv: string[]): void {
  const { sessionsBase, skillsDirs, since, until, agentId } = parseCommonArgs(argv);
  const jsonOut = hasFlag(argv, "json");
  const byDay = hasFlag(argv, "by-day");
  const bySession = hasFlag(argv, "by-session");

  const records = loadAllToolCalls({
    sessionsDir: sessionsBase,
    agentId,
    since,
    until,
  });

  const toolToSkill = buildToolToSkillMap(skillsDirs);
  const stats = aggregateStats(records, toolToSkill, skillsDirs);

  if (jsonOut) {
    const payload: Record<string, unknown> = {
      totalCalls: stats.totalCalls,
      bySkill: stats.bySkill,
      unusedSkillNames: stats.unusedSkillNames,
      unknownToolNames: stats.unknownToolNames,
    };
    if (byDay) {
      payload.byDay = Object.fromEntries(
        [...stats.byDay.entries()].map(([day, m]) => [day, Object.fromEntries(m)])
      );
    }
    if (bySession) {
      payload.bySession = Object.fromEntries(
        [...stats.bySession.entries()].map(([sid, m]) => [sid, Object.fromEntries(m)])
      );
    }
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log("OpenClaw Skill Usage Stats");
  console.log("==========================");
  console.log(`Sessions base: ${sessionsBase}`);
  console.log(`Total tool calls: ${stats.totalCalls}`);
  console.log("");
  if (stats.bySkill.length > 0) {
    console.log("By skill:");
    const maxName = Math.max(20, ...stats.bySkill.map((s) => s.skillName.length));
    for (const s of stats.bySkill) {
      const name = s.skillName.padEnd(maxName);
      const pct = s.pct.toFixed(1);
      console.log(`  ${name}  ${String(s.count).padStart(6)}  ${pct}%  ${s.firstAt ?? ""}  ${s.lastAt ?? ""}`);
    }
  }
  if (stats.unusedSkillNames.length > 0) {
    console.log("");
    console.log("Unused (installed but 0 calls):");
    console.log("  " + stats.unusedSkillNames.join(", "));
  }
  if (stats.unknownToolNames.length > 0) {
    console.log("");
    console.log("Unknown tool names (not mapped to any skill):");
    console.log("  " + stats.unknownToolNames.join(", "));
  }
  if (byDay && stats.byDay.size > 0) {
    console.log("");
    console.log("By day:");
    const days = [...stats.byDay.keys()].sort();
    for (const day of days) {
      const m = stats.byDay.get(day)!;
      const parts = [...m.entries()].map(([skill, n]) => `${skill}:${n}`).join(", ");
      console.log(`  ${day}  ${parts}`);
    }
  }
  if (bySession && stats.bySession.size > 0) {
    console.log("");
    console.log("By session (first 20):");
    const sessions = [...stats.bySession.keys()].slice(0, 20);
    for (const sid of sessions) {
      const m = stats.bySession.get(sid)!;
      const parts = [...m.entries()].map(([skill, n]) => `${skill}:${n}`).join(", ");
      console.log(`  ${sid}  ${parts}`);
    }
  }
}

function runSuggest(argv: string[]): void {
  const { sessionsBase, skillsDirs, since, until, agentId } = parseCommonArgs(argv);
  const minCallsArg = readValueArg(argv, "min-calls");
  const minCalls = minCallsArg !== undefined ? Number(minCallsArg) : 0;
  if (!Number.isInteger(minCalls) || minCalls < 0) {
    throw new CliUsageError("Invalid --min-calls: expected a non-negative integer");
  }
  const outputFormat = readValueArg(argv, "output") ?? "text";
  if (outputFormat !== "text" && outputFormat !== "json") {
    throw new CliUsageError("Invalid --output: expected text or json");
  }
  const jsonOut = outputFormat === "json" || hasFlag(argv, "json");

  const records = loadAllToolCalls({
    sessionsDir: sessionsBase,
    agentId,
    since,
    until,
  });

  const toolToSkill = buildToolToSkillMap(skillsDirs);
  const stats = aggregateStats(records, toolToSkill, skillsDirs);
  const options = suggest(stats, skillsDirs, { minCalls });

  if (jsonOut) {
    console.log(JSON.stringify(options, null, 2));
    return;
  }

  console.log("OpenClaw Skill Optimization Suggestions");
  console.log("=======================================");
  for (const opt of options) {
    const label = opt.severity.toUpperCase();
    console.log("");
    console.log(`[${label}] ${opt.title}`);
    console.log(opt.body);
    if (opt.skillNames && opt.skillNames.length > 0) {
      if (opt.skillNames.length <= 10) {
        console.log("  Skills: " + opt.skillNames.join(", "));
      } else {
        console.log(`  Skills (${opt.skillNames.length}): ${opt.skillNames.slice(0, 5).join(", ")} ...`);
      }
    }
  }
}

function printHelp(): void {
  console.log(`
openclaw-skill-stats - Stats and optimization suggestions for OpenClaw skills

Usage:
  openclaw-skill-stats [stats] [options]   Show usage statistics (default)
  openclaw-skill-stats suggest [options]    Show optimization suggestions

Options (both commands):
  --sessions-dir <path>   Base dir for agents/sessions (default: ~/.clawdbot/agents)
  --skills-dirs <path>    Comma-separated skill dirs (default: ./skills,~/.openclaw/skills)
  --since <YYYY-MM-DD>    Only include calls on or after this date
  --until <YYYY-MM-DD>    Only include calls on or before this date
  --agent <id>            Only include sessions for this agent id

Stats options:
  --by-day                Include per-day breakdown
  --by-session            Include per-session breakdown
  --json                  Output machine-readable JSON

Suggest options:
  --min-calls <n>         Treat skills with fewer than n calls as low-usage (default: 0)
  --output text|json     Output format (default: text)
  --json                  Same as --output json

Environment:
  OPENCLAW_SESSIONS_DIR   Overrides default sessions base
`);
}

main();
