import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import type { SkillMeta, ToolToSkillMap } from "./types.js";

const DEFAULT_SKILLS_DIR = join(
  process.env.HOME || process.env.USERPROFILE || "",
  ".openclaw",
  "skills"
);

function readSkillMeta(skillDir: string, skillNameFromDir: string): SkillMeta | null {
  const skillPath = join(skillDir, "SKILL.md");
  if (!existsSync(skillPath)) return null;
  const raw = readFileSync(skillPath, "utf-8");
  const { data: frontmatter, content } = matter(raw);
  const name = (frontmatter?.name as string) ?? skillNameFromDir;
  const description = (frontmatter?.description as string) ?? "";

  const toolNames: string[] = [];
  const toolsPath = join(skillDir, "tools.json");
  if (existsSync(toolsPath)) {
    try {
      const toolsJson = JSON.parse(readFileSync(toolsPath, "utf-8"));
      if (Array.isArray(toolsJson)) {
        for (const t of toolsJson) {
          if (t?.name) toolNames.push(String(t.name));
        }
      } else if (toolsJson && typeof toolsJson === "object" && Array.isArray(toolsJson.tools)) {
        for (const t of toolsJson.tools) {
          if (t?.name) toolNames.push(String(t.name));
        }
      } else if (toolsJson && typeof toolsJson === "object") {
        for (const key of Object.keys(toolsJson)) {
          if (key && typeof (toolsJson as Record<string, unknown>)[key] === "object") {
            toolNames.push(key);
          }
        }
      }
    } catch {
      // ignore invalid tools.json
    }
  }

  return {
    name,
    description,
    location: skillDir,
    toolNames,
  };
}

/** Scan one directory for skill subdirs (each has SKILL.md). */
export function scanSkillsInDir(dir: string, sourceLabel?: string): SkillMeta[] {
  const out: SkillMeta[] = [];
  if (!existsSync(dir)) return out;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const skillDir = join(dir, e.name);
    const meta = readSkillMeta(skillDir, e.name);
    if (meta) {
      if (sourceLabel) (meta as SkillMeta & { source?: string }).source = sourceLabel;
      out.push(meta);
    }
  }
  return out;
}

/** Get default managed skills dir. */
export function getDefaultSkillsDir(): string {
  return DEFAULT_SKILLS_DIR;
}

/**
 * Build tool → skill map from multiple skill directories.
 * Order of dirs = priority (first wins): typically [workspace, managed, bundled].
 */
export function buildToolToSkillMap(skillsDirs: string[]): ToolToSkillMap {
  const map: ToolToSkillMap = new Map();
  const allMeta: SkillMeta[] = [];
  for (let i = 0; i < skillsDirs.length; i++) {
    const label = i === 0 ? "workspace" : i === 1 ? "managed" : "bundled";
    allMeta.push(...scanSkillsInDir(skillsDirs[i], label));
  }

  for (const meta of allMeta) {
    for (const toolName of meta.toolNames) {
      if (!map.has(toolName)) {
        map.set(toolName, { skillName: meta.name, source: (meta as SkillMeta & { source?: string }).source });
      }
    }
    if (meta.toolNames.length === 0) {
      const key = meta.name;
      if (!map.has(key)) {
        map.set(key, { skillName: meta.name, source: (meta as SkillMeta & { source?: string }).source });
      }
    }
  }
  return map;
}

/** List all installed skill names (from given dirs). */
export function listInstalledSkillNames(skillsDirs: string[]): string[] {
  const seen = new Set<string>();
  for (const dir of skillsDirs) {
    for (const meta of scanSkillsInDir(dir)) {
      seen.add(meta.name);
    }
  }
  return [...seen].sort();
}

/** Estimate prompt chars for skills list (OpenClaw formula: 195 + sum(97 + len(name) + len(description) + len(location))). */
export function estimateSkillPromptChars(metas: SkillMeta[]): number {
  let total = 195;
  for (const m of metas) {
    const nameEsc = escapeXml(m.name);
    const descEsc = escapeXml(m.description);
    const locEsc = escapeXml(m.location);
    total += 97 + nameEsc.length + descEsc.length + locEsc.length;
  }
  return total;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
