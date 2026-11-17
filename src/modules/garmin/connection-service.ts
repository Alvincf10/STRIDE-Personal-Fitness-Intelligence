import { getEnv } from "@/config/env";
import { connectMongo } from "@/lib/database/mongoose";
import {
  decryptSecret,
  encryptSecret,
  hasEncryptionKey,
} from "@/lib/encryption/aes";
import { GarminConnection } from "@/models";
import { GarminAdapter, GarminAdapterError } from "./adapter";

const DEFAULT_BASE = "https://personal.connectapi.garmin.com";

function baseUrl() {
  return getEnv().GARMIN_API_BASE_URL || DEFAULT_BASE;
}

export async function getConnectionStatus() {
  await connectMongo();
  const conn = await GarminConnection.findOne().lean();
  if (!conn) {
    return {
      status: "disconnected" as const,
      lastSuccessfulSyncAt: null,
      lastActivitySyncAt: null,
      lastHealthSyncAt: null,
      capabilities: new GarminAdapter("", baseUrl()).capabilities(),
    };
  }
  return {
    status: conn.status,
    lastSuccessfulSyncAt: conn.lastSuccessfulSyncAt ?? null,
    lastActivitySyncAt: conn.lastActivitySyncAt ?? null,
    lastHealthSyncAt: conn.lastHealthSyncAt ?? null,
    capabilities: new GarminAdapter("", baseUrl()).capabilities(),
  };
}

export async function connectGarmin(apiKey: string) {
  if (!hasEncryptionKey()) {
    throw new Error(
      "ENCRYPTION_KEY is required before storing Garmin credentials"
    );
  }
  await connectMongo();
  const encryptedApiKey = encryptSecret(apiKey.trim());
  const conn = await GarminConnection.findOneAndUpdate(
    {},
    {
      provider: "garmin",
      status: "connected",
      encryptedApiKey,
      $unset: { encryptedAccessToken: 1, tokenExpiresAt: 1 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return {
    status: conn.status,
    lastSuccessfulSyncAt: conn.lastSuccessfulSyncAt ?? null,
  };
}

export async function disconnectGarmin() {
  await connectMongo();
  await GarminConnection.deleteMany({});
  return { status: "disconnected" as const };
}

export async function createAuthenticatedAdapter() {
  await connectMongo();
  const conn = await GarminConnection.findOne();
  if (!conn) {
    throw new GarminAdapterError(
      "GARMIN_NOT_CONNECTED",
      "No Garmin credentials are stored."
    );
  }
  if (!hasEncryptionKey()) {
    throw new Error("ENCRYPTION_KEY is required to use stored credentials");
  }

  const apiKey = decryptSecret(conn.encryptedApiKey);
  const adapter = new GarminAdapter(apiKey, baseUrl());

  if (conn.encryptedAccessToken && conn.tokenExpiresAt) {
    try {
      adapter.setCachedToken(
        decryptSecret(conn.encryptedAccessToken),
        conn.tokenExpiresAt
      );
    } catch {
      // Ignore corrupt cached token; obtainToken will refresh.
    }
  }

  return { adapter, conn };
}

export async function persistAdapterToken(
  connectionId: unknown,
  adapter: GarminAdapter
) {
  const token = adapter.getCachedToken();
  if (!token || !hasEncryptionKey()) return;
  await GarminConnection.updateOne(
    { _id: connectionId },
    {
      encryptedAccessToken: encryptSecret(token.accessToken),
      tokenExpiresAt: token.expiresAt,
      status: "connected",
    }
  );
}

export async function testGarminConnection() {
  const { adapter, conn } = await createAuthenticatedAdapter();
  try {
    const result = await adapter.testConnection();
    await persistAdapterToken(conn._id, adapter);
    return result;
  } catch (error) {
    const status =
      error instanceof GarminAdapterError &&
      (error.code.startsWith("GARMIN_AUTH") || error.code === "GARMIN_TOKEN_FAILED")
        ? "expired"
        : "error";
    await GarminConnection.updateOne({ _id: conn._id }, { status });
    throw error;
  }
}
