import type {
  ToolCallRecord,
  ToolToSkillMap,
  StatsResult,
  SkillCount,
  ByDayStats,
  BySessionStats,
} from "./types.js";
import { listInstalledSkillNames } from "./skills.js";

function resolveSkillName(record: ToolCallRecord, map: ToolToSkillMap): string {
  if (record.skillName) return record.skillName;
  const entry = map.get(record.toolName);
  return entry ? entry.skillName : "__unknown__";
}

export function aggregateStats(
  records: ToolCallRecord[],
  toolToSkill: ToolToSkillMap,
  skillsDirs: string[]
): StatsResult {
  const bySkill = new Map<string, { count: number; firstAt: string | null; lastAt: string | null }>();
  const byDay: ByDayStats = new Map();
  const bySession: BySessionStats = new Map();
  const unknownTools = new Set<string>();

  for (const r of records) {
    const skillName = resolveSkillName(r, toolToSkill);
    if (skillName === "__unknown__") unknownTools.add(r.toolName);

    const day = r.timestamp.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, new Map());
    const dayMap = byDay.get(day)!;
    dayMap.set(skillName, (dayMap.get(skillName) ?? 0) + 1);

    if (!bySession.has(r.sessionId)) bySession.set(r.sessionId, new Map());
    const sessMap = bySession.get(r.sessionId)!;
    sessMap.set(skillName, (sessMap.get(skillName) ?? 0) + 1);

    let cur = bySkill.get(skillName);
    if (!cur) {
      cur = { count: 0, firstAt: r.timestamp, lastAt: r.timestamp };
      bySkill.set(skillName, cur);
    }
    cur.count++;
    if (r.timestamp < (cur.firstAt ?? "")) cur.firstAt = r.timestamp;
    if (r.timestamp > (cur.lastAt ?? "")) cur.lastAt = r.timestamp;
  }

  const totalCalls = records.length;
  const skillCounts: SkillCount[] = [];
  for (const [skillName, data] of bySkill.entries()) {
    const pct = totalCalls > 0 ? (data.count / totalCalls) * 100 : 0;
    skillCounts.push({
      skillName,
      count: data.count,
      pct,
      firstAt: data.firstAt,
      lastAt: data.lastAt,
    });
  }
  skillCounts.sort((a, b) => b.count - a.count);

  const installed = new Set(listInstalledSkillNames(skillsDirs));
  const usedSkills = new Set(bySkill.keys());
  usedSkills.delete("__unknown__");
  const unusedSkillNames = [...installed].filter((s) => !usedSkills.has(s)).sort();

  return {
    totalCalls,
    bySkill: skillCounts,
    byDay,
    bySession,
    unusedSkillNames,
    unknownToolNames: [...unknownTools].sort(),
  };
}
