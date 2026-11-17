import { Schema, model, models, type InferSchemaType } from "mongoose";

const UserAchievementSchema = new Schema(
  {
    achievementId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    unlockedAt: { type: Date, required: true },
    sourceActivityId: { type: Schema.Types.ObjectId, ref: "Activity" },
    evidence: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export type UserAchievementDocument = InferSchemaType<
  typeof UserAchievementSchema
> & {
  _id: Schema.Types.ObjectId;
};

export const UserAchievement =
  models.UserAchievement ||
  model("UserAchievement", UserAchievementSchema, "user_achievements");
