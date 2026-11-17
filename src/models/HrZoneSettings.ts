import { Schema, model, models, type InferSchemaType } from "mongoose";

const ZoneSchema = new Schema(
  {
    zone: { type: Number, required: true },
    minBpm: { type: Number, required: true },
    maxBpm: { type: Number, required: true },
    label: { type: String, required: true },
  },
  { _id: false }
);

const HrZoneSettingsSchema = new Schema(
  {
    method: {
      type: String,
      enum: ["custom", "max_hr", "heart_rate_reserve"],
      required: true,
      default: "custom",
    },
    maxHeartRateBpm: { type: Number },
    restingHeartRateBpm: { type: Number },
    zones: { type: [ZoneSchema], required: true },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

export type HrZoneSettingsDocument = InferSchemaType<
  typeof HrZoneSettingsSchema
> & {
  _id: Schema.Types.ObjectId;
};

export const HrZoneSettings =
  models.HrZoneSettings ||
  model("HrZoneSettings", HrZoneSettingsSchema, "hr_zone_settings");
