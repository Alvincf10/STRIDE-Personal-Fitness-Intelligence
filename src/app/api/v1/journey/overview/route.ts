import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import {
  evaluateAchievements,
  getJourneyOverview,
} from "@/modules/journey/service";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;
  await evaluateAchievements();
  return ok(await getJourneyOverview());
}
