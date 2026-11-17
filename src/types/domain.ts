export type DistanceUnit = "km" | "mi";
export type PaceUnit = "min/km" | "min/mi";

export type GarminConnectionStatus =
  | "connected"
  | "expired"
  | "error"
  | "disconnected";

export type SyncType = "activities" | "health" | "reconciliation";
export type SyncStatus = "running" | "success" | "failed";

export type RecommendationCategory =
  | "training"
  | "recovery"
  | "heart_rate"
  | "performance";

export type Severity = "info" | "low" | "medium" | "high";

export type RuleResultStatus =
  | "triggered"
  | "not_triggered"
  | "insufficient_data";

export type RuleResult = {
  ruleId: string;
  ruleVersion: string;
  status: RuleResultStatus;
  severity?: Severity;
  explanation: string;
  evidence: Array<{
    metric: string;
    value: number | string;
    unit?: string;
    threshold?: number;
  }>;
};
