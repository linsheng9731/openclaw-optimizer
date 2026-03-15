/** One tool-call record extracted from a session message */
export interface ToolCallRecord {
  timestamp: string;
  toolName: string;
  skillName: string | null;
  sessionId: string;
  agentId: string;
}

/** Skill metadata from SKILL.md + tools */
export interface SkillMeta {
  name: string;
  description: string;
  location: string;
  toolNames: string[];
}

/** Tool name → skill name (and optional source for conflicts) */
export type ToolToSkillMap = Map<string, { skillName: string; source?: string }>;

/** Aggregated counts by skill */
export interface SkillCount {
  skillName: string;
  count: number;
  pct: number;
  firstAt: string | null;
  lastAt: string | null;
}

/** By-day breakdown: date → skill → count */
export type ByDayStats = Map<string, Map<string, number>>;

/** By-session breakdown: sessionId → skill → count */
export type BySessionStats = Map<string, Map<string, number>>;

export interface StatsResult {
  totalCalls: number;
  bySkill: SkillCount[];
  byDay: ByDayStats;
  bySession: BySessionStats;
  unusedSkillNames: string[];
  unknownToolNames: string[];
}

export interface SuggestOption {
  id: string;
  severity: "info" | "warn" | "tip";
  title: string;
  body: string;
  skillNames?: string[];
}
