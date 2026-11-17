import { Schema, model, models, type InferSchemaType } from "mongoose";

const LapSchema = new Schema(
  {
    lapNumber: { type: Number, required: true },
    distanceMeters: { type: Number },
    durationSeconds: { type: Number },
    averagePaceSecPerKm: { type: Number },
    averageHeartRateBpm: { type: Number },
  },
  { _id: false }
);

const SampleSchema = new Schema(
  {
    timestamp: { type: Date, required: true },
    heartRateBpm: { type: Number },
    paceSecPerKm: { type: Number },
    cadenceSpm: { type: Number },
    altitudeMeters: { type: Number },
  },
  { _id: false }
);

const RoutePointSchema = new Schema(
  {
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    altitudeMeters: { type: Number },
    timestamp: { type: Date },
  },
  { _id: false }
);

const ActivityDetailSchema = new Schema(
  {
    activityId: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
      ref: "Activity",
    },
    laps: { type: [LapSchema], default: [] },
    samples: { type: [SampleSchema], default: [] },
    routePoints: { type: [RoutePointSchema], default: [] },
    routeSource: {
      type: String,
      enum: ["garmin_track", "start_end", "none"],
      default: "none",
    },
  },
  { timestamps: true }
);

export type ActivityDetailDocument = InferSchemaType<
  typeof ActivityDetailSchema
> & {
  _id: Schema.Types.ObjectId;
};

export const ActivityDetail =
  models.ActivityDetail ||
  model("ActivityDetail", ActivityDetailSchema, "activity_details");
