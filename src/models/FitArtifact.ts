import { Schema, model, models, type InferSchemaType } from "mongoose";

const FitArtifactSchema = new Schema(
  {
    garminActivityId: { type: String, required: true, unique: true, index: true },
    activityId: { type: Schema.Types.ObjectId, ref: "Activity", index: true },
    status: {
      type: String,
      enum: ["downloaded", "stored", "parse_pending", "parsed", "error", "unavailable"],
      required: true,
    },
    contentType: { type: String },
    byteSize: { type: Number },
    checksumSha256: { type: String },
    storagePath: { type: String },
    downloadedAt: { type: Date },
    parserVersion: { type: String },
    parseStatus: { type: String },
    sanitizedError: { type: String },
    sourceEndpoint: { type: String },
  },
  { timestamps: true }
);

export type FitArtifactDocument = InferSchemaType<typeof FitArtifactSchema> & {
  _id: Schema.Types.ObjectId;
};

export const FitArtifact =
  models.FitArtifact ||
  model("FitArtifact", FitArtifactSchema, "fit_artifacts");
