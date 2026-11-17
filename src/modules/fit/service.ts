import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { connectMongo } from "@/lib/database/mongoose";
import { Activity, ActivityDetail, FitArtifact } from "@/models";
import {
  createAuthenticatedAdapter,
  persistAdapterToken,
} from "@/modules/garmin/connection-service";
import {
  extractFitBufferFromZip,
  FIT_PARSER_VERSION,
  parseFitBuffer,
} from "@/modules/fit/parse";

const SOURCE_ENDPOINT = "/download-service/files/activity/{id}";

function storageRoot() {
  return path.join(process.cwd(), "data", "fit");
}

export async function getFitStatus(garminActivityId?: string) {
  await connectMongo();
  if (garminActivityId) {
    const row = await FitArtifact.findOne({ garminActivityId }).lean();
    return {
      endpoint: SOURCE_ENDPOINT,
      authorized: true,
      note: "FIT ZIP download + parse into samples/route/laps.",
      parserVersion: FIT_PARSER_VERSION,
      artifact: row,
    };
  }
  const rows = await FitArtifact.find().sort({ updatedAt: -1 }).limit(20).lean();
  return {
    endpoint: SOURCE_ENDPOINT,
    authorized: true,
    note: "FIT download + parse available.",
    parserVersion: FIT_PARSER_VERSION,
    artifacts: rows,
    count: await FitArtifact.countDocuments(),
  };
}

export async function parseStoredFit(garminActivityId: string) {
  await connectMongo();
  const artifact = await FitArtifact.findOne({ garminActivityId });
  if (!artifact?.storagePath) {
    throw new Error("No stored FIT ZIP for this activity.");
  }
  const activity =
    (artifact.activityId
      ? await Activity.findById(artifact.activityId)
      : null) ??
    (await Activity.findOne({ garminActivityId }));
  if (!activity) throw new Error("Linked activity not found");

  const zipBuf = await readFile(artifact.storagePath);
  const fitBuf = await extractFitBufferFromZip(zipBuf);
  const parsed = await parseFitBuffer(fitBuf);

  await ActivityDetail.findOneAndUpdate(
    { activityId: activity._id },
    {
      $set: {
        samples: parsed.samples,
        routePoints: parsed.routePoints,
        routeSource: parsed.routePoints.length >= 2 ? "garmin_track" : "none",
        laps: parsed.laps.length ? parsed.laps : [],
      },
    },
    { upsert: true, new: true }
  );

  artifact.status = "parsed";
  artifact.parseStatus = "parsed";
  artifact.parserVersion = FIT_PARSER_VERSION;
  artifact.sanitizedError = undefined;
  await artifact.save();

  return {
    garminActivityId,
    activityId: String(activity._id),
    recordCount: parsed.recordCount,
    lapCount: parsed.lapCount,
    routePoints: parsed.routePoints.length,
    parserVersion: FIT_PARSER_VERSION,
    status: "parsed" as const,
  };
}

export async function parseAllStoredFits(limit = 50) {
  await connectMongo();
  const rows = await FitArtifact.find({
    storagePath: { $exists: true, $ne: null },
    status: { $in: ["stored", "parse_pending", "parsed", "downloaded"] },
  })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  const results: Array<{
    garminActivityId: string;
    ok: boolean;
    recordCount?: number;
    routePoints?: number;
    error?: string;
  }> = [];

  for (const row of rows) {
    try {
      const parsed = await parseStoredFit(row.garminActivityId);
      results.push({
        garminActivityId: row.garminActivityId,
        ok: true,
        recordCount: parsed.recordCount,
        routePoints: parsed.routePoints,
      });
    } catch (err) {
      results.push({
        garminActivityId: row.garminActivityId,
        ok: false,
        error: err instanceof Error ? err.message : "parse failed",
      });
    }
  }

  return {
    attempted: results.length,
    parsed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

export async function downloadFitForActivity(
  activityMongoId: string,
  options?: { parse?: boolean }
) {
  await connectMongo();
  const activity = await Activity.findById(activityMongoId);
  if (!activity) throw new Error("Activity not found");

  const { adapter, conn } = await createAuthenticatedAdapter();
  const garminId = activity.garminActivityId;
  const endpoint = `/download-service/files/activity/${encodeURIComponent(garminId)}`;
  const shouldParse = options?.parse !== false;

  try {
    const token = (await adapter.obtainToken()).accessToken;
    const res = await fetch(
      `${(process.env.GARMIN_API_BASE_URL || "https://personal.connectapi.garmin.com").replace(/\/$/, "")}${endpoint}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "*/*",
        },
      }
    );

    if (!res.ok) {
      const artifact = await FitArtifact.findOneAndUpdate(
        { garminActivityId: garminId },
        {
          $set: {
            activityId: activity._id,
            status: res.status === 404 ? "unavailable" : "error",
            sourceEndpoint: endpoint,
            sanitizedError: `FIT download failed (${res.status}).`,
            downloadedAt: new Date(),
          },
        },
        { upsert: true, new: true }
      ).lean();
      await persistAdapterToken(conn._id, adapter);
      return artifact;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const checksum = createHash("sha256").update(buf).digest("hex");
    await mkdir(storageRoot(), { recursive: true });
    const storagePath = path.join(storageRoot(), `${garminId}.zip`);
    await writeFile(storagePath, buf);

    await FitArtifact.findOneAndUpdate(
      { garminActivityId: garminId },
      {
        $set: {
          activityId: activity._id,
          status: "stored",
          contentType: res.headers.get("content-type") ?? "application/zip",
          byteSize: buf.length,
          checksumSha256: checksum,
          storagePath,
          downloadedAt: new Date(),
          parserVersion: FIT_PARSER_VERSION,
          parseStatus: "parse_pending",
          sourceEndpoint: endpoint,
          sanitizedError: null,
        },
      },
      { upsert: true, new: true }
    );

    await persistAdapterToken(conn._id, adapter);

    if (shouldParse) {
      const parsed = await parseStoredFit(garminId);
      return {
        ...(await FitArtifact.findOne({ garminActivityId: garminId }).lean()),
        parse: parsed,
      };
    }

    return FitArtifact.findOne({ garminActivityId: garminId }).lean();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "FIT download failed.";
    return FitArtifact.findOneAndUpdate(
      { garminActivityId: garminId },
      {
        $set: {
          activityId: activity._id,
          status: "error",
          sourceEndpoint: endpoint,
          sanitizedError: message,
          downloadedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    ).lean();
  }
}
