import { Schema, model, models, type InferSchemaType } from "mongoose";

const GarminConnectionSchema = new Schema(
  {
    provider: { type: String, enum: ["garmin"], required: true, default: "garmin" },
    status: {
      type: String,
      enum: ["connected", "expired", "error", "disconnected"],
      required: true,
      default: "disconnected",
    },
    encryptedApiKey: { type: String, required: true },
    encryptedAccessToken: { type: String },
    tokenExpiresAt: { type: Date },
    lastSuccessfulSyncAt: { type: Date },
    lastActivitySyncAt: { type: Date },
    lastHealthSyncAt: { type: Date },
    activityWatermark: { type: Date },
  },
  { timestamps: true }
);

export type GarminConnectionDocument = InferSchemaType<
  typeof GarminConnectionSchema
> & {
  _id: Schema.Types.ObjectId;
};

export const GarminConnection =
  models.GarminConnection ||
  model("GarminConnection", GarminConnectionSchema, "garmin_connections");
