import { Schema, model, models, type InferSchemaType } from "mongoose";

const FeatureCapabilitySchema = new Schema(
  {
    provider: { type: String, enum: ["garmin"], required: true, default: "garmin" },
    endpointKey: { type: String, required: true },
    label: { type: String, required: true },
    status: {
      type: String,
      enum: ["available", "unavailable", "untested", "error"],
      required: true,
      default: "untested",
    },
    lastCheckedAt: { type: Date },
    lastSuccessAt: { type: Date },
    sampleFields: { type: [String], default: [] },
    sanitizedNote: { type: String },
  },
  { timestamps: true }
);

FeatureCapabilitySchema.index({ provider: 1, endpointKey: 1 }, { unique: true });

export type FeatureCapabilityDocument = InferSchemaType<
  typeof FeatureCapabilitySchema
> & {
  _id: Schema.Types.ObjectId;
};

export const FeatureCapability =
  models.FeatureCapability ||
  model("FeatureCapability", FeatureCapabilitySchema, "feature_capabilities");
