import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { connectMongo } from "@/lib/database/mongoose";
import { Activity, FitArtifact } from "@/models";
import {
  createAuthenticatedAdapter,
  persistAdapterToken,
} from "@/modules/garmin/connection-service";

const PARSER_VERSION = "0.1.0-store-only";
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
      note: "Garmin Personal API returns ZIP containing ACTIVITY.fit (confirmed).",
      artifact: row,
    };
  }
  const rows = await FitArtifact.find().sort({ updatedAt: -1 }).limit(20).lean();
  return {
    endpoint: SOURCE_ENDPOINT,
    authorized: true,
    note: "FIT download available. Parser stores file + checksum; full sample re-parse is parse_pending.",
    artifacts: rows,
    count: await FitArtifact.countDocuments(),
  };
}

export async function downloadFitForActivity(activityMongoId: string) {
  await connectMongo();
  const activity = await Activity.findById(activityMongoId);
  if (!activity) throw new Error("Activity not found");

  const { adapter, conn } = await createAuthenticatedAdapter();
  const garminId = activity.garminActivityId;
  const endpoint = `/download-service/files/activity/${encodeURIComponent(garminId)}`;

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

    const artifact = await FitArtifact.findOneAndUpdate(
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
          parserVersion: PARSER_VERSION,
          parseStatus: "parse_pending",
          sourceEndpoint: endpoint,
          sanitizedError: null,
        },
      },
      { upsert: true, new: true }
    ).lean();

    await persistAdapterToken(conn._id, adapter);
    return artifact;
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
