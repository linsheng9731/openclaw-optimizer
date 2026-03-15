import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAllToolCalls } from "../src/parser.js";
import { buildToolToSkillMap } from "../src/skills.js";
import { aggregateStats } from "../src/stats.js";
import { suggest } from "../src/suggest.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");
const SESSIONS_BASE = join(FIXTURES, "sessions");
const SKILLS_DIR = join(FIXTURES, "skills");

describe("stats and suggest", () => {
  it("aggregateStats produces bySkill, byDay, unusedSkillNames", () => {
    const records = loadAllToolCalls({ sessionsDir: SESSIONS_BASE });
    const toolToSkill = buildToolToSkillMap([SKILLS_DIR]);
    const stats = aggregateStats(records, toolToSkill, [SKILLS_DIR]);

    expect(stats.totalCalls).toBe(4);
    expect(stats.bySkill.length).toBeGreaterThanOrEqual(2);
    const feishu = stats.bySkill.find((s) => s.skillName === "feishu-doc");
    expect(feishu?.count).toBe(2);
    const sessionLogs = stats.bySkill.find((s) => s.skillName === "session-logs");
    expect(sessionLogs?.count).toBe(1);
    const unknown = stats.bySkill.find((s) => s.skillName === "__unknown__");
    expect(unknown?.count).toBe(1);

    expect(stats.unusedSkillNames).toContain("unused-skill");
    expect(stats.byDay.size).toBeGreaterThanOrEqual(1);
    expect(stats.byDay.has("2026-01-15")).toBe(true);
  });

  it("suggest returns options including unused-or-low and token-impact", () => {
    const records = loadAllToolCalls({ sessionsDir: SESSIONS_BASE });
    const toolToSkill = buildToolToSkillMap([SKILLS_DIR]);
    const stats = aggregateStats(records, toolToSkill, [SKILLS_DIR]);
    const options = suggest(stats, [SKILLS_DIR], { minCalls: 0 });

    const unused = options.find((o) => o.id === "unused-or-low");
    expect(unused).toBeDefined();
    expect(unused?.skillNames).toContain("unused-skill");

    const token = options.find((o) => o.id === "token-impact");
    expect(token).toBeDefined();
  });
});
