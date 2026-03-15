import type { StatsResult, SuggestOption } from "./types.js";
import {
  scanSkillsInDir,
  estimateSkillPromptChars,
  listInstalledSkillNames,
} from "./skills.js";

const CHARS_PER_TOKEN_EST = 4;
const HIGH_CALLS_THRESHOLD = 100;

export function suggest(
  stats: StatsResult,
  skillsDirs: string[],
  options: { minCalls?: number } = {}
): SuggestOption[] {
  const minCalls = options.minCalls ?? 0;
  const out: SuggestOption[] = [];

  const lowOrUnused = [
    ...stats.unusedSkillNames,
    ...stats.bySkill
      .filter((s) => s.skillName !== "__unknown__" && s.count < minCalls)
      .map((s) => s.skillName),
  ];
  const lowOrUnusedSet = new Set(lowOrUnused);
  if (lowOrUnusedSet.size > 0) {
    out.push({
      id: "unused-or-low",
      severity: "tip",
      title: "Unused or low-usage skills",
      body:
        "Consider disabling these skills in openclaw.json (skills.entries.<name>.enabled: false) or removing them to reduce prompt size and cognitive load. Only disable if you are sure you do not need them.",
      skillNames: [...lowOrUnusedSet].sort(),
    });
  }

  const allMeta: { name: string; description: string; location: string }[] = [];
  for (const dir of skillsDirs) {
    for (const m of scanSkillsInDir(dir)) {
      allMeta.push({ name: m.name, description: m.description, location: m.location });
    }
  }
  const totalChars = estimateSkillPromptChars(
    allMeta.map((m) => ({ ...m, toolNames: [] }))
  );
  const estTokens = Math.ceil(totalChars / CHARS_PER_TOKEN_EST);
  out.push({
    id: "token-impact",
    severity: "info",
    title: "Skill prompt token estimate",
    body: `Current eligible skills use ~${totalChars} characters (~${estTokens} tokens) in the system prompt. Disabling unused skills (see above) will reduce this.`,
  });

  const highCallers = stats.bySkill.filter(
    (s) => s.skillName !== "__unknown__" && s.count >= HIGH_CALLS_THRESHOLD
  );
  if (highCallers.length > 0) {
    out.push({
      id: "high-call-check",
      severity: "warn",
      title: "Skills with very high call counts",
      body:
        "If these skills are triggering too often for unrelated queries, consider narrowing their SKILL.md description so they only trigger when appropriate.",
      skillNames: highCallers.map((s) => s.skillName),
    });
  }

  if (stats.unknownToolNames.length > 0) {
    out.push({
      id: "unknown-tools",
      severity: "info",
      title: "Tool calls not mapped to any skill",
      body: `These tool names appeared in session logs but were not found in any scanned skill's tools.json: ${stats.unknownToolNames.join(", ")}. They may be built-in or from bundled skills not in --skills-dirs.`,
    });
  }

  const installed = listInstalledSkillNames(skillsDirs);
  if (installed.length > 0 && stats.totalCalls > 0) {
    const unusedPct = (stats.unusedSkillNames.length / installed.length) * 100;
    if (unusedPct >= 50) {
      out.push({
        id: "many-unused",
        severity: "tip",
        title: "Many installed skills are unused",
        body: `${stats.unusedSkillNames.length} of ${installed.length} installed skills had no calls in the period. Consider pruning to reduce prompt size.`,
        skillNames: stats.unusedSkillNames,
      });
    }
  }

  return out;
}
