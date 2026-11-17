import { Schema, model, models, type InferSchemaType } from "mongoose";

const SeriesPointSchema = new Schema(
  {
    t: { type: Date, required: true },
    v: { type: Number, required: true },
  },
  { _id: false }
);

const DailyMetricsSchema = new Schema(
  {
    date: { type: String, required: true, unique: true, index: true },
    restingHeartRateBpm: { type: Number },
    averageHeartRateBpm: { type: Number },
    maxHeartRateBpm: { type: Number },
    minHeartRateBpm: { type: Number },
    vo2Max: { type: Number },
    hrvMs: { type: Number },
    sleepDurationSeconds: { type: Number },
    sleepScore: { type: Number },
    sleepStartAt: { type: Date },
    sleepEndAt: { type: Date },
    bodyBattery: { type: Number },
    bodyBatteryCharged: { type: Number },
    bodyBatteryDrained: { type: Number },
    bodyBatteryMin: { type: Number },
    bodyBatteryMax: { type: Number },
    stressLevel: { type: Number },
    stressMaxLevel: { type: Number },
    steps: { type: Number },
    stepsGoal: { type: Number },
    floorsAscended: { type: Number },
    intensityMinutes: { type: Number },
    bodyBatterySeries: { type: [SeriesPointSchema], default: [] },
    source: { type: String, enum: ["garmin"], required: true, default: "garmin" },
  },
  { timestamps: true }
);

export type DailyMetricsDocument = InferSchemaType<typeof DailyMetricsSchema> & {
  _id: Schema.Types.ObjectId;
};

export const DailyMetrics =
  models.DailyMetrics ||
  model("DailyMetrics", DailyMetricsSchema, "daily_metrics");
