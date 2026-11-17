import { Schema, model, models, type InferSchemaType } from "mongoose";

const UserSettingsSchema = new Schema(
  {
    timezone: { type: String, required: true, default: "Asia/Jakarta" },
    distanceUnit: {
      type: String,
      enum: ["km", "mi"],
      required: true,
      default: "km",
    },
    paceUnit: {
      type: String,
      enum: ["min/km", "min/mi"],
      required: true,
      default: "min/km",
    },
    weeklyDistanceGoalKm: { type: Number },
  },
  { timestamps: true }
);

export type UserSettingsDocument = InferSchemaType<typeof UserSettingsSchema> & {
  _id: Schema.Types.ObjectId;
};

export const UserSettings =
  models.UserSettings || model("UserSettings", UserSettingsSchema, "user_settings");
