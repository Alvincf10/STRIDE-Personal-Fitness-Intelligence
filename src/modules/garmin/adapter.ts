/**
 * Garmin Connect Personal API adapter.
 * Auth: ApiKey -> bearer JWT (24h). Data: bearer on personal.connectapi.garmin.com
 * Docs: https://developer.garmin.com/gc-developer-program/personal/personal-faq
 */

export type GarminActivitySummary = {
  garminActivityId: string;
  activityType: string;
  activityName?: string;
  startedAt: string;
  distanceMeters?: number;
  durationSeconds?: number;
  movingDurationSeconds?: number;
  averageHeartRateBpm?: number;
  maxHeartRateBpm?: number;
  averageCadenceSpm?: number;
  elevationGainMeters?: number;
  calories?: number;
  raw: Record<string, unknown>;
};

export type GarminCapability = {
  activitiesList: boolean;
  activityDetail: boolean;
  healthSummary: boolean;
  hrSamples: boolean;
};

export type GarminToken = {
  accessToken: string;
  expiresAt: Date;
};

export class GarminAdapterError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "GarminAdapterError";
  }
}

const DEFAULT_BASE = "https://personal.connectapi.garmin.com";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function decodeJwtExp(token: string): Date | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
        "utf8"
      )
    ) as { exp?: number };
    if (typeof payload.exp !== "number") return null;
    return new Date(payload.exp * 1000);
  } catch {
    return null;
  }
}

function mapActivityType(raw: unknown): string {
  const typeObj = asRecord(raw);
  const key = asString(typeObj?.typeKey) ?? asString(raw) ?? "unknown";
  const runningKeys = new Set([
    "running",
    "trail_running",
    "treadmill_running",
    "track_running",
    "indoor_running",
    "virtual_run",
  ]);
  return runningKeys.has(key) ? "running" : key;
}

function normalizeActivity(raw: unknown): GarminActivitySummary | null {
  const row = asRecord(raw);
  if (!row) return null;

  const id =
    asNumber(row.activityId) ??
    asNumber(row.activityIdPk) ??
    (typeof row.activityId === "string" ? Number(row.activityId) : undefined);
  if (id == null || !Number.isFinite(id)) return null;

  const startedAt =
    asString(row.startTimeGMT) ??
    asString(row.startTimeLocal) ??
    asString(row.beginTimestamp);
  if (!startedAt) return null;

  const startedIso = startedAt.includes("T")
    ? new Date(startedAt).toISOString()
    : new Date(`${startedAt.replace(" ", "T")}Z`).toISOString();

  return {
    garminActivityId: String(id),
    activityType: mapActivityType(row.activityType),
    activityName: asString(row.activityName),
    startedAt: startedIso,
    distanceMeters: asNumber(row.distance),
    durationSeconds: asNumber(row.duration) ?? asNumber(row.elapsedDuration),
    movingDurationSeconds: asNumber(row.movingDuration),
    averageHeartRateBpm: asNumber(row.averageHR) ?? asNumber(row.avgHR),
    maxHeartRateBpm: asNumber(row.maxHR),
    averageCadenceSpm:
      asNumber(row.averageRunningCadenceInStepsPerMinute) ??
      asNumber(row.averageCadence),
    elevationGainMeters: asNumber(row.elevationGain),
    calories: asNumber(row.calories),
    raw: row,
  };
}

export class GarminAdapter {
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = DEFAULT_BASE
  ) {}

  capabilities(): GarminCapability {
    return {
      activitiesList: true,
      activityDetail: true,
      healthSummary: true,
      hrSamples: true,
    };
  }

  setCachedToken(token: string | undefined, expiresAt?: Date | null) {
    this.accessToken = token ?? null;
    this.tokenExpiresAt = expiresAt ?? null;
  }

  getCachedToken(): GarminToken | null {
    if (!this.accessToken || !this.tokenExpiresAt) return null;
    return {
      accessToken: this.accessToken,
      expiresAt: this.tokenExpiresAt,
    };
  }

  private root(): string {
    const base = (this.baseUrl || DEFAULT_BASE).replace(/\/$/, "");
    return base;
  }

  async obtainToken(force = false): Promise<GarminToken> {
    if (!this.apiKey) {
      throw new GarminAdapterError(
        "GARMIN_AUTH_INVALID",
        "Garmin authentication failed."
      );
    }

    const stillValid =
      this.accessToken &&
      this.tokenExpiresAt &&
      this.tokenExpiresAt.getTime() - Date.now() > 60 * 60 * 1000;

    if (!force && stillValid && this.accessToken && this.tokenExpiresAt) {
      return {
        accessToken: this.accessToken,
        expiresAt: this.tokenExpiresAt,
      };
    }

    const url = `${this.root()}/personalapitoken-service/personal-api/personal-api-key/token`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `ApiKey ${this.apiKey}`,
        Accept: "text/plain, application/json",
      },
    });

    const bodyText = await res.text();
    if (!res.ok) {
      throw new GarminAdapterError(
        res.status === 401 || res.status === 403
          ? "GARMIN_AUTH_INVALID"
          : "GARMIN_TOKEN_FAILED",
        "Garmin authentication failed.",
        res.status
      );
    }

    let accessToken = bodyText.trim();
    // Some gateways wrap JWT in JSON; prefer plain JWT text.
    if (accessToken.startsWith("{")) {
      try {
        const json = JSON.parse(accessToken) as Record<string, unknown>;
        accessToken =
          asString(json.access_token) ??
          asString(json.accessToken) ??
          asString(json.token) ??
          "";
      } catch {
        accessToken = "";
      }
    }

    if (!accessToken || accessToken.split(".").length < 2) {
      throw new GarminAdapterError(
        "GARMIN_TOKEN_INVALID",
        "Garmin token response was empty or not a JWT."
      );
    }

    const expiresAt =
      decodeJwtExp(accessToken) ??
      new Date(Date.now() + 23 * 60 * 60 * 1000);

    this.accessToken = accessToken;
    this.tokenExpiresAt = expiresAt;
    return { accessToken, expiresAt };
  }

  async testConnection(): Promise<{ ok: true; expiresAt: string }> {
    const token = await this.obtainToken(true);
    // Lightweight authenticated call to confirm the bearer works.
    await this.requestJson(
      "/userprofile-service/userprofile/settings",
      undefined,
      token.accessToken
    );
    return { ok: true, expiresAt: token.expiresAt.toISOString() };
  }

  async listActivities(
    since?: Date,
    options?: { activityType?: string | "all" }
  ): Promise<GarminActivitySummary[]> {
    await this.obtainToken();

    const end = new Date();
    const start = since
      ? new Date(since.getTime() - 24 * 60 * 60 * 1000)
      : new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);

    const startDate = start.toISOString().slice(0, 10);
    const endDate = end.toISOString().slice(0, 10);
    const activityType = options?.activityType ?? "running";

    const collected: GarminActivitySummary[] = [];
    let offset = 0;
    const limit = 50;

    while (offset < 500) {
      const params = new URLSearchParams({
        start: String(offset),
        limit: String(limit),
        startDate,
        endDate,
        sortBy: "startLocal",
        sortOrder: "desc",
      });
      if (activityType !== "all") {
        params.set("activityType", activityType);
      }

      const payload = await this.requestJson(
        `/activitylist-service/activities/search/activities?${params.toString()}`
      );

      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(asRecord(payload)?.activities)
          ? (asRecord(payload)!.activities as unknown[])
          : [];

      if (rows.length === 0) break;

      for (const row of rows) {
        const normalized = normalizeActivity(row);
        if (normalized) collected.push(normalized);
      }

      if (rows.length < limit) break;
      offset += limit;
    }

    return collected;
  }

  async getActivityDetail(garminActivityId: string): Promise<{
    summary: GarminActivitySummary;
    laps: Array<{
      lapNumber: number;
      distanceMeters?: number;
      durationSeconds?: number;
      averagePaceSecPerKm?: number;
      averageHeartRateBpm?: number;
    }>;
    samples: Array<{
      timestamp: Date;
      heartRateBpm?: number;
      paceSecPerKm?: number;
      cadenceSpm?: number;
      altitudeMeters?: number;
    }>;
  }> {
    await this.obtainToken();
    const payload = await this.requestJson(
      `/activity-service/activity/${encodeURIComponent(garminActivityId)}`
    );
    const summarySource =
      asRecord(payload)?.summaryDTO ??
      asRecord(payload)?.summary ??
      payload;
    const summary = normalizeActivity({
      ...(asRecord(summarySource) ?? {}),
      activityId: garminActivityId,
      activityName:
        asString(asRecord(payload)?.activityName) ??
        asString(asRecord(summarySource)?.activityName),
      activityType:
        asRecord(payload)?.activityType ??
        asRecord(summarySource)?.activityType,
      startTimeGMT:
        asString(asRecord(summarySource)?.startTimeGMT) ??
        asString(asRecord(payload)?.startTimeGMT),
    });

    if (!summary) {
      throw new GarminAdapterError(
        "GARMIN_ACTIVITY_PARSE",
        "Could not normalize activity detail."
      );
    }

    const lapRows =
      (asRecord(payload)?.laps as unknown[]) ??
      (asRecord(payload)?.splits as unknown[]) ??
      [];

    const laps = (Array.isArray(lapRows) ? lapRows : []).map((lap, index) => {
      const row = asRecord(lap) ?? {};
      const distance = asNumber(row.distance) ?? asNumber(row.distanceInMeters);
      const duration = asNumber(row.duration) ?? asNumber(row.elapsedDuration);
      return {
        lapNumber: asNumber(row.lapIndex) ?? asNumber(row.splitNumber) ?? index + 1,
        distanceMeters: distance,
        durationSeconds: duration,
        averagePaceSecPerKm:
          distance && duration && distance > 0
            ? duration / (distance / 1000)
            : undefined,
        averageHeartRateBpm: asNumber(row.averageHR) ?? asNumber(row.avgHR),
      };
    });

    return { summary, laps, samples: [] };
  }

  async get(path: string, params?: Record<string, string>): Promise<unknown> {
    const query =
      params && Object.keys(params).length
        ? `?${new URLSearchParams(params).toString()}`
        : "";
    return this.requestJson(`${path}${query}`);
  }

  async getDailySummaries(startDate: string, endDate: string) {
    return this.get("/usersummary-service/v2/dailysummaries", {
      startDate,
      endDate,
    });
  }

  async getSleepSummaries(startDate: string, endDate: string) {
    return this.get("/sleep-service/sleep/dailySleepSummariesByDate", {
      startDate,
      endDate,
    });
  }

  async getHrvSummaries(startDate: string, endDate: string) {
    return this.get(`/hrv-service/hrv/daily/${startDate}/${endDate}`);
  }

  async getVo2Max(startDate: string, endDate: string) {
    return this.get(`/metrics-service/metrics/maxmet/daily/${startDate}/${endDate}`);
  }

  async getBodyBattery(startDate: string, endDate: string) {
    return this.get("/wellness-service/wellness/bodyBattery/reports/daily", {
      startDate,
      endDate,
    });
  }

  async getDailyStress(startDate: string, endDate: string) {
    return this.get(
      `/usersummary-service/stats/stress/daily/${startDate}/${endDate}`
    );
  }

  /**
   * Time-series charts + GPS polyline for one activity.
   * Personal API: /activity-service/activity/{id}/details
   */
  async getActivityDetailsCharts(garminActivityId: string): Promise<unknown> {
    await this.obtainToken();
    return this.requestJson(
      `/activity-service/activity/${encodeURIComponent(garminActivityId)}/details`
    );
  }

  private async requestJson(
    path: string,
    init?: RequestInit,
    tokenOverride?: string
  ): Promise<unknown> {
    const token = tokenOverride ?? (await this.obtainToken()).accessToken;
    const url = path.startsWith("http") ? path : `${this.root()}${path}`;

    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (res.status === 401) {
      // One forced renew + retry.
      const renewed = await this.obtainToken(true);
      const retry = await fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${renewed.accessToken}`,
          Accept: "application/json",
          ...(init?.headers ?? {}),
        },
      });
      if (!retry.ok) {
        throw new GarminAdapterError(
          "GARMIN_AUTH_EXPIRED",
          "Garmin authentication failed.",
          retry.status
        );
      }
      if (retry.status === 204) return null;
      return retry.json();
    }

    if (!res.ok) {
      throw new GarminAdapterError(
        res.status === 429 ? "GARMIN_RATE_LIMITED" : "GARMIN_API_ERROR",
        `Garmin API request failed (${res.status}).`,
        res.status
      );
    }

    if (res.status === 204) return null;
    return res.json();
  }
}
