import { Schema, model, models, type InferSchemaType } from "mongoose";

const EvidenceSchema = new Schema(
  {
    metric: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
    unit: { type: String },
    threshold: { type: Number },
  },
  { _id: false }
);

const RecommendationSchema = new Schema(
  {
    ruleId: { type: String, required: true },
    ruleVersion: { type: String, required: true },
    category: {
      type: String,
      enum: ["training", "recovery", "heart_rate", "performance"],
      required: true,
    },
    severity: {
      type: String,
      enum: ["info", "low", "medium", "high"],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    evidence: { type: [EvidenceSchema], default: [] },
    dataSufficiency: {
      type: String,
      enum: ["sufficient", "insufficient"],
      required: true,
    },
    confidence: {
      type: String,
      enum: ["high", "medium", "low"],
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "dismissed", "expired"],
      required: true,
      default: "active",
    },
    generatedAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date },
  },
  { timestamps: false }
);

RecommendationSchema.index({ status: 1, generatedAt: -1 });

export type RecommendationDocument = InferSchemaType<
  typeof RecommendationSchema
> & {
  _id: Schema.Types.ObjectId;
};

export const Recommendation =
  models.Recommendation ||
  model("Recommendation", RecommendationSchema, "recommendations");
