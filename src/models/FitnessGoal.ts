import { Schema, model, models, type InferSchemaType } from "mongoose";

const FitnessGoalSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["1k", "5k", "10k", "half_marathon", "marathon", "custom"],
      required: true,
    },
    title: { type: String, required: true },
    targetDistanceMeters: { type: Number },
    targetTimeSeconds: { type: Number },
    targetDate: { type: Date },
    status: {
      type: String,
      enum: ["active", "paused", "completed", "cancelled"],
      required: true,
      default: "active",
    },
    notes: { type: String },
  },
  { timestamps: true }
);

export type FitnessGoalDocument = InferSchemaType<typeof FitnessGoalSchema> & {
  _id: Schema.Types.ObjectId;
};

export const FitnessGoal =
  models.FitnessGoal || model("FitnessGoal", FitnessGoalSchema, "fitness_goals");
