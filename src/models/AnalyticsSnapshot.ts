import { Schema, model, models, type InferSchemaType } from "mongoose";

const AnalyticsSnapshotSchema = new Schema(
  {
    period: { type: String, enum: ["weekly", "monthly"], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalDistanceMeters: { type: Number, required: true, default: 0 },
    totalDurationSeconds: { type: Number, required: true, default: 0 },
    activityCount: { type: Number, required: true, default: 0 },
    averagePaceSecPerKm: { type: Number },
    averageHeartRateBpm: { type: Number },
    zoneDistributionSeconds: {
      z1: { type: Number, default: 0 },
      z2: { type: Number, default: 0 },
      z3: { type: Number, default: 0 },
      z4: { type: Number, default: 0 },
      z5: { type: Number, default: 0 },
      unclassified: { type: Number, default: 0 },
    },
    generatedAt: { type: Date, required: true, default: Date.now },
    calculationVersion: { type: String, required: true, default: "1.0.0" },
  },
  { timestamps: false }
);

AnalyticsSnapshotSchema.index({ period: 1, startDate: 1, endDate: 1 });

export type AnalyticsSnapshotDocument = InferSchemaType<
  typeof AnalyticsSnapshotSchema
> & {
  _id: Schema.Types.ObjectId;
};

export const AnalyticsSnapshot =
  models.AnalyticsSnapshot ||
  model("AnalyticsSnapshot", AnalyticsSnapshotSchema, "analytics_snapshots");
