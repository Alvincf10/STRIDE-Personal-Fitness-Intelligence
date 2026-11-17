import { Schema, model, models, type InferSchemaType } from "mongoose";

const SyncLogSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["activities", "health", "reconciliation"],
      required: true,
    },
    status: {
      type: String,
      enum: ["running", "success", "failed"],
      required: true,
    },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date },
    recordsFetched: { type: Number, required: true, default: 0 },
    recordsCreated: { type: Number, required: true, default: 0 },
    recordsUpdated: { type: Number, required: true, default: 0 },
    errorCode: { type: String },
    sanitizedErrorMessage: { type: String },
  },
  { timestamps: false }
);

SyncLogSchema.index({ startedAt: -1 });

export type SyncLogDocument = InferSchemaType<typeof SyncLogSchema> & {
  _id: Schema.Types.ObjectId;
};

export const SyncLog =
  models.SyncLog || model("SyncLog", SyncLogSchema, "sync_logs");
