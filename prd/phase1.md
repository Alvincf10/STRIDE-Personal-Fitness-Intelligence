Garmin Fitness Intelligence Dashboard
Product Requirements Document (PRD)
  Field                  Value
  Document version       1.0
Status                 Draft
Date                   17 November 2026
Product                Garmin Fitness Intelligence Dashboard
Target device          Garmin Forerunner 165
Target user            Single personal user
Primary sport          Running
Data synchronization   Automatic, scheduled pull
Recommendation model   Deterministic / rule-based
AI/LLM                 Out of scope for MVP
1. Executive Summary
Garmin Fitness Intelligence Dashboard is a personal web application that
retrieves the user's Garmin data, stores historical records, analyzes
running performance, and produces explainable training recommendations
using deterministic rules.

The application complements Garmin Connect; it does not replace the
Garmin device or Garmin Connect. Its purpose is to turn activity and
available health data into longitudinal insights that help the user
understand running consistency, heart-rate behavior, pace progression,
training volume, and recovery indicators.

The MVP focuses on running. Data synchronization is automatic through
the Garmin Connect Personal API, subject to the API's access model,
supported endpoints, device capabilities, and data availability.
2. Product Vision
Provide one reliable personal workspace for understanding running
performance over time and making more informed training decisions from
the user's own Garmin data.
2.1 Product principles
1. Data integrity first: preserve source data and make
   transformations traceable.
2. Deterministic calculations: metrics and recommendations must be
   reproducible.
3. Explainability: every recommendation must show its triggering
   evidence.
4. Personal baselines: compare the user primarily with their own
   historical data.
5. Privacy by design: credentials and personal fitness data remain
   private.
6. Graceful degradation: missing metrics must be represented as
   unavailable, never fabricated.
3. Goals and Non-Goals
3.1 Goals
  ID                      Goal                    Priority
  G-01                    Connect to Garmin       P0
Personal API            

  G-02                    Automatically           P0
synchronize running
activities              

  G-03                    Store activity history  P0
without duplicates      

  G-04                    Display running         P0
overview and activity
details                 

  G-05                    Analyze pace, distance, P0
duration, and heart
rate                    

  G-06                    Configure and analyze   P0
heart-rate zones        

  G-07                    Generate explainable    P0
deterministic
recommendations         

  G-08                    Show weekly and monthly P0
progress                

  G-09                    Track VO2 Max when      P1
available               
G-10                    Incorporate sleep, HRV, P2
stress, and recovery
data when available
3.2 Non-goals for MVP
- Multi-user or public SaaS functionality.
- Replacing Garmin Connect.
- Controlling the watch or sending workouts to it.
- Medical diagnosis or treatment recommendations.
- LLM-generated training decisions.
- Social features, leaderboards, or coach accounts.
- Integrations with other wearable vendors.
4. Target User and Primary Use Cases
4.1 Target user
A single user who owns a Garmin Forerunner 165 and primarily uses it for
running. The user wants to monitor heart rate, Zone 2 consistency, pace,
distance, VO2 Max trends, and training progression.
4.2 Primary use cases
- View a consolidated summary of recent running activity.
- Inspect an individual run, including laps and available time-series
  samples.
- Review time spent in each configured heart-rate zone.
- Compare weekly and monthly distance and duration.
- Evaluate pace trends across comparable sessions.
- Review personal performance trends such as VO2 Max when supplied by
  Garmin.
- Receive recommendations with clear reasons and supporting
  measurements.
- Check whether Garmin synchronization succeeded and when it last ran.
- Correct personal settings such as timezone, units, and heart-rate
  zones.
5. Scope and Functional Requirements
Priority definitions: - P0: required for MVP. - P1: valuable
follow-up. - P2: optional future enhancement.
FR-01 --- Garmin Connection
Priority: P0

The system shall: - Allow the owner to configure Garmin Personal API
credentials. - Store credentials encrypted at rest. - Generate and
manage access tokens according to the supported Garmin authentication
flow. - Test the connection and expose a sanitized connection status. -
Never expose API keys or access tokens to browser clients. - Allow the
owner to disconnect and remove stored credentials.

Acceptance criteria - Valid credentials can be tested
successfully. - Invalid or expired credentials produce a clear,
sanitized error. - Secrets are not returned by any API response or
written to application logs. - Disconnect removes or invalidates stored
credentials and stops scheduled Garmin sync.
FR-02 --- Automatic Synchronization
Priority: P0

The system shall: - Run scheduled synchronization jobs. - Support manual
sync from the authenticated dashboard. - Fetch newly available
activities and relevant updates. - Use a stored synchronization
watermark to avoid repeatedly fetching the full history. - Prevent
duplicate activities using the Garmin activity identifier. - Record job
start, finish, status, counts, and sanitized errors. - Retry transient
failures with bounded exponential backoff. - Prevent concurrent
duplicate jobs for the same sync type.

Initial schedule - Activity sync: every 30 minutes. - Health summary
sync: every 2 hours, if supported and enabled. - Historical
reconciliation: daily. - Analytics recalculation: after successful
relevant data changes.

These are application defaults, not guarantees of Garmin data freshness
or API availability. The schedule must be configurable.

Acceptance criteria - A new activity is imported after it becomes
available from Garmin. - Re-running the same sync does not create
duplicates. - Failed jobs are visible in sync history. - A transient
error can be retried without corrupting existing data. - The UI displays
the last successful synchronization time.
FR-03 --- Activity Management
Priority: P0

The system shall: - List running activities with date, distance,
duration, pace, and heart-rate summaries when available. - Show an
activity detail page. - Store lap data and optional time-series samples
separately from the activity summary. - Filter activities by date range
and activity type. - Support pagination. - Preserve source identifiers
and raw source payloads where appropriate.

Acceptance criteria - Activity totals and details are derived from
stored normalized records. - Missing source fields are shown as
unavailable. - Activity records can be reconciled or updated without
creating duplicates.
FR-04 --- Running Dashboard
Priority: P0

The overview shall display: - Total running distance for the selected
period. - Total running duration. - Number of runs. - Average pace, with
clearly defined calculation method. - Average and maximum heart rate
when available. - Weekly distance trend. - Recent activities. - Latest
recommendation. - Garmin connection and sync status.

Acceptance criteria - Date range and timezone behavior are
consistent. - Summary values reconcile with the underlying activity
records. - Empty states are shown when no activity exists.
FR-05 --- Heart-Rate Zone Analytics
Priority: P0

The system shall: - Allow manual configuration of HR zones. - Support a
configurable zone calculation method, such as custom BPM boundaries,
percentage of maximum HR, or heart-rate reserve, where required inputs
exist. - Calculate time and percentage spent in each zone when sample
data is available. - Display the configuration used for each analysis. -
Avoid assuming universal zone boundaries.

Acceptance criteria - Zone boundaries are validated and
non-overlapping. - Zone durations are calculated only from valid
heart-rate samples. - If only average HR is available, the system must
not invent zone distribution. - The total classified duration and
unclassified duration are distinguishable.
FR-06 --- Performance Analytics
Priority: P0

The system shall calculate: - Weekly and monthly running distance. -
Weekly and monthly running duration. - Activity count. - Average pace
using a documented aggregation method. - Pace progression across
comparable sessions. - Heart-rate trends. - Cadence trends when
available. - Personal records based on available activity data.

Priority P1 - VO2 Max progression. - Elevation and climbing
trends. - Pace-at-heart-rate efficiency comparisons.

Acceptance criteria - Every metric has a documented unit and
calculation. - Comparisons use equivalent date windows and disclose
missing data. - Outlier handling is documented and does not silently
discard source records.
FR-07 --- Deterministic Recommendation Engine
Priority: P0

The system shall generate recommendations from versioned rules and
validated metrics. No LLM is used to decide the recommendation.

Each recommendation shall include: - Rule identifier and rule version. -
Category. - Title and explanation. - Severity. - Supporting evidence and
evaluated values. - Data sufficiency status. - Generation timestamp. -
Expiry or reevaluation policy.

Initial categories: - Training consistency. - Heart-rate intensity. -
Weekly volume. - Pace progression. - Recovery indicators, only when
sufficient supported data exists.

Acceptance criteria - The same input dataset and rule version
produce the same result. - Every recommendation can be traced to its
rule and evidence. - Missing data results in insufficient_data, not an
assumed normal state. - Rules are unit-tested with positive, negative,
boundary, and missing-data cases. - Recommendations are informational
and do not claim to diagnose health conditions.
FR-08 --- Reports
Priority: P0

The system shall provide weekly and monthly summaries containing: -
Distance and duration totals. - Number of runs. - Pace and heart-rate
trends where available. - HR-zone distribution where sample data
permits. - Progress observations. - Active recommendations.

Priority P1: downloadable CSV or PDF reports.
FR-09 --- Settings
Priority: P0

The system shall allow configuration of: - Timezone (default:
Asia/Jakarta). - Distance and pace units. - HR-zone method and
boundaries. - Maximum and resting heart rate when required by the
selected method. - Weekly distance goal (optional). - Synchronization
schedule (within safe configured bounds).
6. Non-Functional Requirements
  ID                      Requirement             Target
  NFR-01                  Security                HTTPS, authenticated
app, encrypted secrets

  NFR-02                  Privacy                 Single-owner access; no
public sharing

  NFR-03                  Reliability             Idempotent sync and
bounded retries

  NFR-04                  Data integrity          Unique source IDs and
validated units

  NFR-05                  Performance             Typical dashboard API
response under 1 second
for cached summaries

  NFR-06                  Maintainability         Modular monolith with
isolated integration
adapters

  NFR-07                  Observability           Structured logs and
sync status

  NFR-08                  Backup                  Scheduled database
backup and tested
restore

  NFR-09                  Responsive UI           Desktop and mobile
browser support
NFR-10                  Testability             Unit, integration, and
end-to-end tests
Performance targets are engineering objectives and should be measured in
the deployed environment.
7. System Architecture
7.1 Architecture style
Use a modular monolith for the personal MVP. This avoids premature
microservices while keeping Garmin integration, synchronization,
analytics, and recommendations separated by module boundaries.
7.2 Technology stack
  Layer           Technology
  Frontend        Next.js App Router + TypeScript
UI              Tailwind CSS + shadcn/ui
Charts          Recharts
Backend         Next.js Route Handlers
Validation      Zod
Database        MongoDB
ODM             Mongoose
Scheduler       Cron or a dedicated worker process
Testing         Vitest + Playwright
Deployment      Docker Compose
Reverse proxy   Caddy or Nginx
7.3 Logical components
1. Web UI: overview, running activities, HR analytics, performance,
   recommendations, history, and settings.
2. Application API: authenticated REST endpoints for the UI.
3. Garmin adapter: encapsulates Garmin authentication, API calls,
   response parsing, and provider-specific errors.
4. Sync worker: scheduled and manual jobs, locking, watermarking,
   retry, and sync logs.
5. Normalizer: converts source payloads into canonical internal
   units and schemas.
6. Analytics engine: deterministic calculations over normalized
   data.
7. Recommendation engine: evaluates versioned rules against
   validated metrics.
8. Persistence layer: MongoDB repositories and indexes.
7.4 Data flow
1. The watch synchronizes with Garmin Connect using Garmin's supported
   device workflow.
2. The backend obtains data from the Garmin Personal API using the
   supported pull model.
3. The sync worker retrieves available activities and supported health
   data.
4. The normalizer validates and converts units.
5. Raw source payloads and normalized records are persisted.
6. Analytics are recalculated for affected periods.
7. Recommendation rules are evaluated.
8. The dashboard reads the stored summaries through authenticated
   application APIs.
7.5 Integration constraints
- Verify current Garmin Personal API eligibility, onboarding, terms,
  and endpoint availability before implementation.
- The Personal API is intended for personal access; do not assume it
  authorizes a multi-user commercial service.
- Treat Garmin API availability, rate limits, payload fields, and
  freshness as external constraints.
- Do not assume every Forerunner 165 metric is exposed by every
  endpoint.
- Build a capability check and mark unsupported or unavailable metrics
  explicitly.
- Keep the Garmin adapter replaceable in case the integration method
  changes.
8. Database Schema
MongoDB collections:
8.1 user_settings
interface UserSettings {
  _id: ObjectId;
  timezone: string; // Asia/Jakarta
  distanceUnit: "km" | "mi";
  paceUnit: "min/km" | "min/mi";
  weeklyDistanceGoalKm?: number;
  createdAt: Date;
  updatedAt: Date;
}
8.2 garmin_connections
interface GarminConnection {
  _id: ObjectId;
  provider: "garmin";
  status: "connected" | "expired" | "error" | "disconnected";
  encryptedApiKey: string;
  encryptedAccessToken?: string;
  tokenExpiresAt?: Date;
  lastSuccessfulSyncAt?: Date;
  lastActivitySyncAt?: Date;
  lastHealthSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
Secrets must use authenticated encryption such as AES-256-GCM. The
encryption key must be stored outside MongoDB and outside source
control.
8.3 activities
interface Activity {
  _id: ObjectId;
  garminActivityId: string;
  activityType: string;
  activityName?: string;
  startedAt: Date; // UTC
  timezone?: string;
  distanceMeters?: number;
  durationSeconds?: number;
  movingDurationSeconds?: number;
  averagePaceSecPerKm?: number;
  bestPaceSecPerKm?: number;
  averageHeartRateBpm?: number;
  maxHeartRateBpm?: number;
  averageCadenceSpm?: number;
  maxCadenceSpm?: number;
  elevationGainMeters?: number;
  calories?: number;
  source: "garmin";
  rawPayload?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
Indexes: - Unique index on garminActivityId. - Descending index on
startedAt. - Compound index on activityType and startedAt.
8.4 activity_details
interface ActivityDetail {
  _id: ObjectId;
  activityId: ObjectId;
  laps?: Array<{
    lapNumber: number;
    distanceMeters?: number;
    durationSeconds?: number;
    averagePaceSecPerKm?: number;
    averageHeartRateBpm?: number;
  }>;
  samples?: Array<{
    timestamp: Date;
    heartRateBpm?: number;
    paceSecPerKm?: number;
    cadenceSpm?: number;
    altitudeMeters?: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}
Store high-volume samples separately from the activity summary. Consider
time-series collections or compressed storage if sample volume grows.
8.5 daily_metrics
interface DailyMetrics {
  _id: ObjectId;
  date: string; // YYYY-MM-DD in user's configured timezone
  restingHeartRateBpm?: number;
  averageHeartRateBpm?: number;
  maxHeartRateBpm?: number;
  vo2Max?: number;
  hrvMs?: number;
  sleepDurationSeconds?: number;
  sleepScore?: number;
  bodyBattery?: number;
  stressLevel?: number;
  steps?: number;
  source: "garmin";
  createdAt: Date;
  updatedAt: Date;
}
Use a unique index on date for the single-user MVP. Keep all fields
optional.
8.6 hr_zone_settings
interface HrZoneSettings {
  _id: ObjectId;
  method: "custom" | "max_hr" | "heart_rate_reserve";
  maxHeartRateBpm?: number;
  restingHeartRateBpm?: number;
  zones: Array<{
    zone: number;
    minBpm: number;
    maxBpm: number;
    label: string;
  }>;
  updatedAt: Date;
}
Validate that boundaries are ordered, non-overlapping, and consistent
with the selected method.
8.7 analytics_snapshots
interface AnalyticsSnapshot {
  _id: ObjectId;
  period: "weekly" | "monthly";
  startDate: Date;
  endDate: Date;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  activityCount: number;
  averagePaceSecPerKm?: number;
  averageHeartRateBpm?: number;
  zoneDistributionSeconds?: {
    z1: number;
    z2: number;
    z3: number;
    z4: number;
    z5: number;
    unclassified: number;
  };
  generatedAt: Date;
  calculationVersion: string;
}
8.8 recommendations
interface Recommendation {
  _id: ObjectId;
  ruleId: string;
  ruleVersion: string;
  category: "training" | "recovery" | "heart_rate" | "performance";
  severity: "info" | "low" | "medium" | "high";
  title: string;
  description: string;
  evidence: Array<{
    metric: string;
    value: number | string;
    unit?: string;
    threshold?: number;
  }>;
  dataSufficiency: "sufficient" | "insufficient";
  confidence: "high" | "medium" | "low";
  status: "active" | "dismissed" | "expired";
  generatedAt: Date;
  expiresAt?: Date;
}
8.9 sync_logs
interface SyncLog {
  _id: ObjectId;
  type: "activities" | "health" | "reconciliation";
  status: "running" | "success" | "failed";
  startedAt: Date;
  completedAt?: Date;
  recordsFetched: number;
  recordsCreated: number;
  recordsUpdated: number;
  errorCode?: string;
  sanitizedErrorMessage?: string;
}
9. API Specification
All application endpoints use /api/v1. All endpoints require the
single-user application session unless explicitly designated as an
internal worker endpoint.
9.1 Garmin connection
  Method   Endpoint               Purpose
  POST     /garmin/connect      Store Garmin API credential
GET      /garmin/status       Read connection status
POST     /garmin/test         Test connection
DELETE   /garmin/disconnect   Disconnect and remove credentials

POST /garmin/connect request:
{
  "apiKey": "GARMIN_PERSONAL_API_KEY"
}
The response must never include the submitted key or access token.
9.2 Synchronization
  Method   Endpoint             Purpose
  POST     /sync/activities   Queue activity synchronization
POST     /sync/health       Queue health synchronization
POST     /sync/full         Queue all enabled sync types
GET      /sync/status       Read current and last sync state
GET      /sync/logs         Paginated sync history

Manual sync endpoints should enqueue jobs and return a job identifier
rather than hold an HTTP request open during a long-running sync.
9.3 Activities
  Method   Endpoint                 Purpose
  GET      /activities            List activities
GET      /activities/:id        Activity detail
GET      /activities/summary    Summary for a date range
GET      /activities/:id/laps   Lap data

Example:
GET /api/v1/activities?from=2026-11-01&to=2026-11-30&type=running&page=1&limit=20
9.4 Analytics
  Method   Endpoint                  Purpose
  GET      /analytics/overview     Dashboard KPIs
GET      /analytics/weekly       Weekly performance
GET      /analytics/monthly      Monthly performance
GET      /analytics/pace         Pace progression
GET      /analytics/heart-rate   HR trends
GET      /analytics/zones        HR zone distribution
GET      /analytics/vo2max       VO2 Max trend
9.5 Recommendations
  Method   Endpoint                         Purpose
  GET      /recommendations               List recommendations
GET      /recommendations/today         Current recommendations
POST     /recommendations/evaluate      Queue rule evaluation
PATCH    /recommendations/:id/dismiss   Dismiss recommendation
9.6 Settings
  Method   Endpoint               Purpose
  GET      /settings            Read settings
PATCH    /settings            Update settings
GET      /settings/hr-zones   Read HR-zone configuration
PUT      /settings/hr-zones   Replace HR-zone configuration
9.7 Standard response format
Success:
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2026-11-17T08:00:00Z"
  }
}
Error:
{
  "success": false,
  "error": {
    "code": "GARMIN_AUTH_EXPIRED",
    "message": "Garmin authentication failed."
  }
}
Use stable error codes, correct HTTP status codes, request validation,
pagination limits, and sanitized messages.
10. Deterministic Recommendation Engine
10.1 Design requirements
- Rules are implemented as pure functions where possible.
- Each rule has an identifier and version.
- Inputs are validated and include units and time windows.
- Missing or stale inputs result in an insufficient-data outcome.
- Rules must not diagnose medical conditions.
- Thresholds are configurable and documented.
- The same inputs and rule version must produce the same output.
10.2 Initial rules
  Rule ID           Name              Input             Output
  RUN-001           Zone 2            HR samples, zone  Aerobic training
consistency       settings, session consistency
duration          insight

  RUN-002           Heart-rate drift  HR and pace time  Session
series            efficiency
observation

  RUN-003           Weekly volume     Current and       Volume-change
change            previous          notice
comparable weeks  

  RUN-004           Resting HR trend  Daily RHR and     Trend observation
personal baseline 

  RUN-005           Recovery          Available sleep,  Cautious recovery
indicators        HRV, RHR data     suggestion
RUN-006           Pace progression  Comparable runs   Performance trend
and HR
10.3 Rule evaluation contract
type RuleResult = {
  ruleId: string;
  ruleVersion: string;
  status: "triggered" | "not_triggered" | "insufficient_data";
  severity?: "info" | "low" | "medium" | "high";
  explanation: string;
  evidence: Array<{
    metric: string;
    value: number | string;
    unit?: string;
    threshold?: number;
  }>;
};
10.4 Example: weekly volume change
function evaluateWeeklyVolume(
  currentKm: number,
  previousKm: number,
  thresholdPercent = 20
) {
  if (
    !Number.isFinite(currentKm) ||
    !Number.isFinite(previousKm) ||
    previousKm <= 0
  ) {
    return { status: "insufficient_data" as const };
  }

  const changePercent =
    ((currentKm - previousKm) / previousKm) * 100;

  if (changePercent > thresholdPercent) {
    return {
      status: "triggered" as const,
      changePercent,
      explanation:
        "Weekly running volume increased beyond the configured review threshold."
    };
  }

  return {
    status: "not_triggered" as const,
    changePercent
  };
}
The 20% threshold is an initial configurable product heuristic for
testing, not a universal training or medical rule. It must be reviewed
against the user's history and should not independently prescribe a
training load.
11. UI/UX Requirements
11.1 Design direction
- Dark mode by default.
- Technical, focused, and information-rich.
- Responsive for desktop and mobile.
- Clear metric units and date ranges.
- Charts include labels, legends, and accessible summaries.
- Avoid presenting estimates as measured facts.
11.2 Navigation
1. Overview
2. Running Activities
3. Heart Rate Analytics
4. Performance Analytics
5. Recommendations
6. Training History
7. Settings
11.3 Page requirements
  Page                                Main content
  Overview                            KPI cards, weekly trends, recent
runs, sync state, recommendations

  Running Activities                  Activity table, filters, activity
detail, laps

  Heart Rate                          HR trends, zone configuration, zone
distribution

  Performance                         Pace progression, mileage, cadence,
VO2 Max

  Recommendations                     Active rules, explanations,
evidence, history

  History                             Calendar and historical activity
list
Settings                            Garmin connection, timezone, units,
HR zones, sync schedule
Every page must support loading, empty, stale-data, and error states.
12. Security and Privacy
- Require authenticated access to the application.
- Use HTTPS in production.
- Encrypt Garmin API keys and tokens at rest using authenticated
  encryption.
- Store encryption keys in deployment secrets, not in the database or
  repository.
- Never send Garmin credentials to the frontend.
- Redact secrets and sensitive payload fields from logs.
- Restrict database network access.
- Validate all external API payloads before persistence.
- Apply rate limits to application endpoints.
- Protect state-changing endpoints against CSRF where applicable.
- Provide disconnect and credential deletion behavior.
- Maintain encrypted backups and periodically test restoration.
- Do not expose the dashboard publicly without an explicit security
  review.
13. Observability and Operations
Track: - Last successful activity sync. - Last successful health sync. -
Job duration. - Records fetched, inserted, and updated. - API error
category. - Retry count. - Analytics calculation version. -
Recommendation rule version.

Do not log raw credentials, tokens, or unnecessary detailed health data.
14. Testing Strategy
14.1 Unit tests
- Pace and distance conversions.
- Duration and aggregation calculations.
- HR-zone boundary validation.
- Zone-duration calculation.
- Weekly and monthly grouping.
- Recommendation rules.
- Missing-data behavior.
- Timezone and daylight-saving edge cases.
14.2 Integration tests
- Garmin authentication adapter.
- Garmin response normalization.
- MongoDB persistence.
- Unique activity constraint.
- Sync watermark behavior.
- Retry and job locking.
- API authorization and validation.
Use mocked Garmin responses and sanitized fixtures. Do not make
production Garmin calls in routine automated tests.
14.3 End-to-end tests
- Sign in.
- Connect Garmin credentials.
- Trigger sync.
- View imported activity.
- Open activity detail.
- View weekly analytics.
- Review recommendation evidence.
- Update HR zones.
- Disconnect Garmin.
14.4 Acceptance criteria
  ID      Scenario                    Expected result
  TC-01   Valid Garmin credentials    Connection test succeeds
TC-02   Invalid credentials         Sanitized error shown
TC-03   Import activity             Activity persisted
TC-04   Repeat same sync            No duplicate activity
TC-05   Scheduled sync              Worker executes and logs outcome
TC-06   Missing HR samples          Zone distribution marked unavailable
TC-07   Invalid zone boundaries     Validation rejects settings
TC-08   Recommendation evaluation   Deterministic result
TC-09   Insufficient history        No unsupported recommendation
TC-10   Unauthorized request        Access denied
TC-11   Disconnect                  Credentials removed and sync disabled
TC-12   Backup restore              Data can be recovered
15. Development Roadmap
Estimates are engineering working days and exclude external API
onboarding delays.
  Phase                 Scope                                     Estimate
  1. Foundation        Next.js, TypeScript,                     3--4 days
MongoDB, auth,
schemas, UI shell     

  2. Garmin            Credential handling,                     4--6 days
integration           auth, activity
retrieval,
normalization         

  3. Synchronization   Scheduler,                               3--4 days
incremental sync,
idempotency, logs,
retries               

  4. Analytics         Running metrics, HR                      5--7 days
zones, weekly/monthly
reports, trends       

  5. Recommendations   Rule engine,                             4--5 days
evidence,
sufficiency, rule
tests                 

  6. Production        Dashboard completion,                    5--7 days
E2E, Docker,
monitoring, backup    
Total             MVP                            24--33 days
Phase 1 --- Foundation
Deliverables: - Repository and project setup. - Authentication. -
MongoDB connection. - Mongoose schemas and indexes. - Environment
configuration. - Dashboard shell and navigation.

Exit criteria: application runs locally and single-user authentication
works.
Phase 2 --- Garmin Integration
Deliverables: - Garmin API adapter. - Secure credential storage. -
Authentication/token handling. - Activity list and detail retrieval. -
Normalized activity model. - Sanitized fixtures for tests.

Exit criteria: real Garmin activity data can be retrieved and persisted.
Phase 3 --- Synchronization Engine
Deliverables: - Scheduled worker. - Manual sync trigger. - Incremental
synchronization. - Idempotency. - Retry and locking. - Sync logs and
status UI.

Exit criteria: new activities sync automatically without duplication.
Phase 4 --- Analytics Engine
Deliverables: - Activity aggregation. - Pace and distance analytics. -
HR-zone calculations. - Weekly/monthly reports. - Performance trends.

Exit criteria: analytics reconcile with source activities and pass
calculation tests.
Phase 5 --- Recommendation Engine
Deliverables: - Versioned rules. - Evidence model. - Data-sufficiency
checks. - Recommendation persistence. - Rule test fixtures.

Exit criteria: rules produce reproducible and explainable outcomes.
Phase 6 --- Production
Deliverables: - Responsive UI. - Loading, error, and empty states. -
Playwright E2E tests. - Docker Compose. - HTTPS reverse proxy. -
Monitoring and backup.

Exit criteria: application is deployed, protected, recoverable, and
usable.
16. Repository Structure
garmin-fitness-dashboard/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   ├── (dashboard)/
│   │   │   ├── overview/
│   │   │   ├── running/
│   │   │   ├── heart-rate/
│   │   │   ├── performance/
│   │   │   ├── recommendations/
│   │   │   ├── history/
│   │   │   └── settings/
│   │   └── api/v1/
│   ├── components/
│   │   ├── dashboard/
│   │   ├── charts/
│   │   ├── running/
│   │   └── shared/
│   ├── modules/
│   │   ├── garmin/
│   │   ├── synchronization/
│   │   ├── activities/
│   │   ├── analytics/
│   │   ├── recommendations/
│   │   └── settings/
│   ├── lib/
│   │   ├── database/
│   │   ├── encryption/
│   │   ├── validation/
│   │   └── utils/
│   ├── models/
│   ├── types/
│   └── config/
├── workers/
│   └── sync-worker.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── PRD.md
│   ├── SYSTEM_DESIGN.md
│   ├── DATABASE_SCHEMA.md
│   ├── API_SPECIFICATION.md
│   ├── RECOMMENDATION_ENGINE.md
│   └── DEPLOYMENT.md
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
17. Risks and Mitigations
  Risk                    Impact                  Mitigation
  Garmin API access or    Blocks automatic        Validate access with a
onboarding unavailable  integration             proof of concept before
building the full
product

  API contract changes    Sync failures           Isolate provider
adapter and add
contract tests

  Device does not expose  Incomplete analytics    Capability checks and
a metric                                        optional fields

  API throttling or       Delayed sync            Backoff, bounded
downtime                                        retries, sync watermark

  Duplicate imports       Incorrect totals        Unique source ID and
idempotent upsert

  Missing HR samples      Invalid zone analytics  Explicit
insufficient-data state

  Incorrect timezone      Wrong daily totals      Store UTC and group
grouping                                        using configured
timezone

  Credential compromise   Privacy breach          Encryption, least
privilege, secret
redaction
Overconfident           Unsafe training         Evidence, conservative
recommendations         decisions               rules, explicit
limitations
18. MVP Definition of Done
The MVP is complete when:
- Garmin Personal API access has been validated for the personal
  account.
- The application securely stores and uses credentials.
- Running activities synchronize automatically.
- Activity history is persisted without duplicates.
- The dashboard displays correct activity summaries.
- HR-zone analytics work when valid samples and zone settings exist.
- Weekly and monthly performance summaries are available.
- Deterministic recommendations include evidence and data-sufficiency
  checks.
- Unit, integration, and E2E tests pass.
- Production deployment uses HTTPS and protected secrets.
- Database backup and restore have been tested.
19. Recommended First Implementation Task
Start with a Garmin Integration Proof of Concept, before
implementing the complete dashboard.
1. Confirm access to Garmin Connect Personal API and review its current
   documentation and terms.
2. Configure the API key outside source control.
3. Implement a minimal backend authentication client.
4. Retrieve the activity list.
5. Retrieve one running activity's details.
6. Save a sanitized sample response as a test fixture.
7. Confirm which fields and metrics are actually available for the
   Forerunner 165 account.
The proof of concept is the primary technical gate. Do not assume
endpoint access or metric availability until verified against the real
account.