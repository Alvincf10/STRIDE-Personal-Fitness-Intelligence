import type { RuleResult } from "@/types/domain";

export function evaluateWeeklyVolume(
  currentKm: number,
  previousKm: number,
  thresholdPercent = 20
): RuleResult {
  // Tiny previous weeks (e.g. 0.03 km) explode % change and are not comparable.
  const MIN_PREVIOUS_KM = 5;
  if (
    !Number.isFinite(currentKm) ||
    !Number.isFinite(previousKm) ||
    previousKm < MIN_PREVIOUS_KM
  ) {
    return {
      ruleId: "RUN-003",
      ruleVersion: "1.0.0",
      status: "insufficient_data",
      explanation:
        "Need a previous week of at least 5 km before evaluating volume change.",
      evidence: [
        { metric: "currentKm", value: currentKm, unit: "km" },
        { metric: "previousKm", value: previousKm, unit: "km" },
      ],
    };
  }

  const changePercent = ((currentKm - previousKm) / previousKm) * 100;

  if (changePercent > thresholdPercent) {
    return {
      ruleId: "RUN-003",
      ruleVersion: "1.0.0",
      status: "triggered",
      severity: "medium",
      explanation:
        "Weekly running volume increased beyond the configured review threshold.",
      evidence: [
        { metric: "currentKm", value: Number(currentKm.toFixed(2)), unit: "km" },
        { metric: "previousKm", value: Number(previousKm.toFixed(2)), unit: "km" },
        {
          metric: "changePercent",
          value: Number(changePercent.toFixed(1)),
          unit: "%",
          threshold: thresholdPercent,
        },
      ],
    };
  }

  return {
    ruleId: "RUN-003",
    ruleVersion: "1.0.0",
    status: "not_triggered",
    explanation: "Weekly volume change stayed within the review threshold.",
    evidence: [
      { metric: "changePercent", value: Number(changePercent.toFixed(1)), unit: "%" },
    ],
  };
}

export function evaluateZone2Consistency(input: {
  zone2Seconds?: number;
  totalClassifiedSeconds?: number;
  minSharePercent?: number;
}): RuleResult {
  const {
    zone2Seconds,
    totalClassifiedSeconds,
    minSharePercent = 40,
  } = input;

  if (
    zone2Seconds == null ||
    totalClassifiedSeconds == null ||
    totalClassifiedSeconds <= 0
  ) {
    return {
      ruleId: "RUN-001",
      ruleVersion: "1.0.0",
      status: "insufficient_data",
      explanation:
        "Zone 2 consistency needs valid HR samples and zone settings.",
      evidence: [],
    };
  }

  const share = (zone2Seconds / totalClassifiedSeconds) * 100;
  if (share < minSharePercent) {
    return {
      ruleId: "RUN-001",
      ruleVersion: "1.0.0",
      status: "triggered",
      severity: "low",
      explanation:
        "Recent runs spent less time in Zone 2 than the configured aerobic share.",
      evidence: [
        {
          metric: "zone2SharePercent",
          value: Number(share.toFixed(1)),
          unit: "%",
          threshold: minSharePercent,
        },
      ],
    };
  }

  return {
    ruleId: "RUN-001",
    ruleVersion: "1.0.0",
    status: "not_triggered",
    explanation: "Zone 2 share met the configured aerobic consistency floor.",
    evidence: [
      {
        metric: "zone2SharePercent",
        value: Number(share.toFixed(1)),
        unit: "%",
      },
    ],
  };
}

export function evaluatePaceProgression(input: {
  recentPaceSecPerKm?: number;
  baselinePaceSecPerKm?: number;
  improvementPercent?: number;
}): RuleResult {
  const {
    recentPaceSecPerKm,
    baselinePaceSecPerKm,
    improvementPercent = 3,
  } = input;

  if (
    recentPaceSecPerKm == null ||
    baselinePaceSecPerKm == null ||
    baselinePaceSecPerKm <= 0
  ) {
    return {
      ruleId: "RUN-006",
      ruleVersion: "1.0.0",
      status: "insufficient_data",
      explanation:
        "Pace progression needs comparable recent and baseline sessions.",
      evidence: [],
    };
  }

  const change =
    ((baselinePaceSecPerKm - recentPaceSecPerKm) / baselinePaceSecPerKm) * 100;

  if (change >= improvementPercent) {
    return {
      ruleId: "RUN-006",
      ruleVersion: "1.0.0",
      status: "triggered",
      severity: "info",
      explanation: "Recent comparable runs are faster than the baseline window.",
      evidence: [
        {
          metric: "paceImprovementPercent",
          value: Number(change.toFixed(1)),
          unit: "%",
          threshold: improvementPercent,
        },
      ],
    };
  }

  return {
    ruleId: "RUN-006",
    ruleVersion: "1.0.0",
    status: "not_triggered",
    explanation: "Pace change stayed below the review improvement threshold.",
    evidence: [
      {
        metric: "paceImprovementPercent",
        value: Number(change.toFixed(1)),
        unit: "%",
      },
    ],
  };
}
