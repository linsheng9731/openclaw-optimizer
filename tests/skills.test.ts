import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  scanSkillsInDir,
  buildToolToSkillMap,
  listInstalledSkillNames,
  estimateSkillPromptChars,
} from "../src/skills.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");
const SKILLS_DIR = join(FIXTURES, "skills");

describe("skills", () => {
  it("scans skill dirs and reads SKILL.md + tools.json", () => {
    const metas = scanSkillsInDir(SKILLS_DIR);
    expect(metas.length).toBeGreaterThanOrEqual(2);
    const feishu = metas.find((m) => m.name === "feishu-doc");
    expect(feishu).toBeDefined();
    expect(feishu!.toolNames).toContain("read_file");
    const sessionLogs = metas.find((m) => m.name === "session-logs");
    expect(sessionLogs).toBeDefined();
    expect(sessionLogs!.toolNames).toContain("session_logs_search");
  });

  it("buildToolToSkillMap maps tool name to skill", () => {
    const map = buildToolToSkillMap([SKILLS_DIR]);
    expect(map.get("read_file")?.skillName).toBe("feishu-doc");
    expect(map.get("session_logs_search")?.skillName).toBe("session-logs");
  });

  it("listInstalledSkillNames returns all skill names", () => {
    const names = listInstalledSkillNames([SKILLS_DIR]);
    expect(names).toContain("feishu-doc");
    expect(names).toContain("session-logs");
    expect(names).toContain("unused-skill");
  });

  it("estimateSkillPromptChars returns positive number", () => {
    const metas = scanSkillsInDir(SKILLS_DIR);
    const chars = estimateSkillPromptChars(metas);
    expect(chars).toBeGreaterThan(195);
  });
});
