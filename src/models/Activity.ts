import { Schema, model, models, type InferSchemaType } from "mongoose";

const ActivitySchema = new Schema(
  {
    garminActivityId: { type: String, required: true, unique: true, index: true },
    activityType: { type: String, required: true, index: true },
    activityName: { type: String },
    startedAt: { type: Date, required: true, index: true },
    timezone: { type: String },
    distanceMeters: { type: Number },
    durationSeconds: { type: Number },
    movingDurationSeconds: { type: Number },
    averagePaceSecPerKm: { type: Number },
    bestPaceSecPerKm: { type: Number },
    averageHeartRateBpm: { type: Number },
    maxHeartRateBpm: { type: Number },
    averageCadenceSpm: { type: Number },
    maxCadenceSpm: { type: Number },
    elevationGainMeters: { type: Number },
    calories: { type: Number },
    source: { type: String, enum: ["garmin"], required: true, default: "garmin" },
    rawPayload: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

ActivitySchema.index({ activityType: 1, startedAt: -1 });

export type ActivityDocument = InferSchemaType<typeof ActivitySchema> & {
  _id: Schema.Types.ObjectId;
};

export const Activity =
  models.Activity || model("Activity", ActivitySchema, "activities");
