import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  discoverSessionFiles,
  parseSessionFile,
  loadAllToolCalls,
} from "../src/parser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");
const SESSIONS_BASE = join(FIXTURES, "sessions");

describe("parser", () => {
  it("discovers session jsonl files", () => {
    const files = discoverSessionFiles(SESSIONS_BASE);
    expect(files.length).toBeGreaterThanOrEqual(1);
    const s1 = files.find((f) => f.sessionId === "s1" && f.agentId === "agent1");
    expect(s1).toBeDefined();
    expect(s1!.path).toContain("agent1");
    expect(s1!.path.endsWith(".jsonl")).toBe(true);
  });

  it("parses session file and extracts tool calls", () => {
    const files = discoverSessionFiles(SESSIONS_BASE);
    const s1 = files.find((f) => f.sessionId === "s1");
    expect(s1).toBeDefined();
    const records = parseSessionFile(s1!.path, s1!.agentId, s1!.sessionId);
    expect(records.length).toBe(4);
    const withSkill = records.filter((r) => r.skillName !== null);
    expect(withSkill.length).toBe(2);
    expect(withSkill.map((r) => r.skillName)).toContain("feishu-doc");
    expect(withSkill.map((r) => r.skillName)).toContain("session-logs");
    const unknown = records.filter((r) => r.skillName === null && r.toolName === "read_file");
    expect(unknown.length).toBe(1);
  });

  it("loadAllToolCalls with since/until filters", () => {
    const all = loadAllToolCalls({
      sessionsDir: SESSIONS_BASE,
      since: "2026-01-15",
      until: "2026-01-15",
    });
    expect(all.length).toBe(3);
    const all16 = loadAllToolCalls({
      sessionsDir: SESSIONS_BASE,
      since: "2026-01-16",
      until: "2026-01-16",
    });
    expect(all16.length).toBe(1);
  });
});
