import { connectMongo } from "@/lib/database/mongoose";
import { PersonalBaseline } from "@/models";

export async function getBaselineHistory(
  metric?: string,
  limit = 20
) {
  await connectMongo();
  const filter = metric ? { metric } : {};
  return PersonalBaseline.find(filter)
    .sort({ generatedAt: -1 })
    .limit(Math.min(100, Math.max(1, limit)))
    .lean();
}
