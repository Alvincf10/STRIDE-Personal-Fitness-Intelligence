import { Schema, model, models, type InferSchemaType } from "mongoose";

const PersonalBaselineSchema = new Schema(
  {
    metric: {
      type: String,
      enum: [
        "resting_hr",
        "hrv",
        "sleep_duration",
        "pace_at_hr",
        "weekly_distance",
      ],
      required: true,
    },
    windowStart: { type: Date, required: true },
    windowEnd: { type: Date, required: true },
    sampleCount: { type: Number, required: true },
    minimumSampleCount: { type: Number, required: true },
    method: { type: String, required: true },
    value: { type: Number, required: true },
    dispersion: { type: Number },
    unit: { type: String, required: true },
    calculationVersion: { type: String, required: true, default: "1.0.0" },
    generatedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false }
);

PersonalBaselineSchema.index({ metric: 1, generatedAt: -1 });

export type PersonalBaselineDocument = InferSchemaType<
  typeof PersonalBaselineSchema
> & {
  _id: Schema.Types.ObjectId;
};

export const PersonalBaseline =
  models.PersonalBaseline ||
  model("PersonalBaseline", PersonalBaselineSchema, "personal_baselines");
