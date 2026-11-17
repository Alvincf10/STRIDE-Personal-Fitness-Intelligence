import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { getHrZoneIntelligence } from "@/modules/hr-zones/service";

export async function GET(request: Request) {
  const { error } = await requireApiSession();
  if (error) return error;
  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? "28");
  const full = await getHrZoneIntelligence({
    days: Number.isFinite(days) ? days : 28,
  });
  return ok({
    available: full.available,
    status: full.status,
    calculationVersion: full.calculationVersion,
    method: full.method,
    sourceLabel: full.sourceLabel,
    limitations: full.limitations,
    windowDays: full.windowDays,
    zone2: full.zone2,
    eligibleActivityCount: full.eligibleActivityCount,
    ineligibleActivityCount: full.ineligibleActivityCount,
    explanation: full.explanation,
    evaluatedAt: full.evaluatedAt,
  });
}
