export type AvailabilityStatus =
  | "available"
  | "limited"
  | "insufficient_data"
  | "not_supported"
  | "not_synced"
  | "empty"
  | "error"
  | "partial";

export type FeatureReadinessStatus =
  | "ready"
  | "limited"
  | "insufficient_data"
  | "not_supported"
  | "not_synced"
  | "error";

export type FeatureReadiness = {
  featureId: string;
  label: string;
  status: FeatureReadinessStatus;
  requiredMetrics: string[];
  availableMetrics: string[];
  missingMetrics: string[];
  sampleCount: number;
  minimumSampleCount: number;
  coverage: number | null;
  evaluatedAt: string;
  explanation: string;
};

export type MetricAvailability = {
  metricKey: string;
  label: string;
  status: AvailabilityStatus;
  recordCount: number;
  lastObservedAt: string | null;
  sourceEndpoint: string;
  explanation: string;
};
