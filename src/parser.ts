import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ToolCallRecord } from "./types.js";

const DEFAULT_SESSIONS_BASE = join(
  process.env.HOME || process.env.USERPROFILE || "",
  ".clawdbot",
  "agents"
);

/** Raw session line: may be session metadata or message */
interface SessionLine {
  type?: string;
  timestamp?: string;
  message?: {
    role?: string;
    content?: Array<{ type?: string; name?: string; skillName?: string; arguments?: string }>;
  };
}

function parseSessionLine(line: string): SessionLine | null {
  const t = line.trim();
  if (!t) return null;
  try {
    return JSON.parse(t) as SessionLine;
  } catch {
    return null;
  }
}

function extractToolCalls(
  line: SessionLine,
  sessionId: string,
  agentId: string,
  since?: string,
  until?: string
): ToolCallRecord[] {
  if (line.type !== "message" || !line.message?.content) return [];
  const ts = line.timestamp;
  if (!ts) return [];
  const dateStr = ts.slice(0, 10);
  if (since && dateStr < since) return [];
  if (until && dateStr > until) return [];

  const out: ToolCallRecord[] = [];
  for (const block of line.message.content) {
    if (block?.type !== "toolCall" || !block.name) continue;
    let skillName: string | null = null;
    if (typeof block.skillName === "string") {
      skillName = block.skillName;
    } else if (typeof block.arguments === "string") {
      try {
        const args = JSON.parse(block.arguments) as { skillName?: string };
        if (typeof args.skillName === "string") skillName = args.skillName;
      } catch {
        // ignore
      }
    }
    out.push({
      timestamp: ts,
      toolName: block.name,
      skillName,
      sessionId,
      agentId,
    });
  }
  return out;
}

/** Discover all session JSONL paths under agents base (or a single agent dir). */
export function discoverSessionFiles(
  sessionsDirOrBase: string,
  agentIdFilter?: string
): { agentId: string; sessionId: string; path: string }[] {
  const results: { agentId: string; sessionId: string; path: string }[] = [];
  const base = sessionsDirOrBase;

  if (!existsSync(base)) return results;

  const stat = readdirSync(base, { withFileTypes: true });
  const agentDirs = agentIdFilter
    ? stat.filter((d) => d.isDirectory() && d.name === agentIdFilter)
    : stat.filter((d) => d.isDirectory());

  for (const agent of agentDirs) {
    const sessionsPath = join(base, agent.name, "sessions");
    if (!existsSync(sessionsPath)) continue;
    const files = readdirSync(sessionsPath);
    for (const f of files) {
      if (f.endsWith(".jsonl") && !f.includes(".deleted.")) {
        results.push({
          agentId: agent.name,
          sessionId: f.replace(/\.jsonl$/, ""),
          path: join(sessionsPath, f),
        });
      }
    }
  }
  return results;
}

/** Get default sessions base (expands ~/.clawdbot/agents). */
export function getDefaultSessionsBase(): string {
  return DEFAULT_SESSIONS_BASE;
}

/** Parse one session file and return tool-call records. */
export function parseSessionFile(
  filePath: string,
  agentId: string,
  sessionId: string,
  since?: string,
  until?: string
): ToolCallRecord[] {
  const text = readFileSync(filePath, "utf-8");
  const records: ToolCallRecord[] = [];
  for (const raw of text.split("\n")) {
    const line = parseSessionLine(raw);
    if (!line) continue;
    records.push(
      ...extractToolCalls(line, sessionId, agentId, since, until)
    );
  }
  return records;
}

/** Load all tool-call records from discovered session files. */
export function loadAllToolCalls(
  options: {
    sessionsDir?: string;
    agentId?: string;
    since?: string;
    until?: string;
  } = {}
): ToolCallRecord[] {
  const base = options.sessionsDir ?? getDefaultSessionsBase();
  const files = discoverSessionFiles(base, options.agentId);
  const since = options.since;
  const until = options.until;
  const all: ToolCallRecord[] = [];
  for (const { path, agentId, sessionId } of files) {
    all.push(
      ...parseSessionFile(path, agentId, sessionId, since, until)
    );
  }
  return all;
}
