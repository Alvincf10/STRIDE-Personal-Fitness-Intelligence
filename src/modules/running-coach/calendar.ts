import { connectMongo } from "@/lib/database/mongoose";
import { Activity, Recommendation } from "@/models";
import {
  getDailySuggestion,
  type WorkoutType,
} from "@/modules/running-coach/daily-suggestion";

export type PlanSource = "coach_today" | "weekly_template";

export type CalendarEvaluation =
  | "matched"
  | "rest_kept"
  | "missed"
  | "unplanned"
  | "upcoming"
  | "today";

export type CalendarDay = {
  date: string;
  completed: Array<{
    id: string;
    name?: string;
    distanceMeters?: number;
    durationSeconds?: number;
  }>;
  planned: {
    workoutType: WorkoutType;
    title: string;
    source: PlanSource;
  };
  evaluation: CalendarEvaluation;
  evaluationNote: string;
};

function templateForWeekday(weekday: number): {
  workoutType: WorkoutType;
  title: string;
} {
  // 0 Sun … 6 Sat — deterministic weekly skeleton (PRD coach calendar).
  if (weekday === 0 || weekday === 6) {
    return { workoutType: "long_run", title: "Long run window" };
  }
  if (weekday === 1 || weekday === 5) {
    return { workoutType: "rest", title: "Rest / mobility" };
  }
  if (weekday === 2 || weekday === 4) {
    return { workoutType: "tempo", title: "Optional tempo" };
  }
  return { workoutType: "easy", title: "Easy aerobic" };
}

function evaluateDay(input: {
  plannedType: WorkoutType;
  completedCount: number;
  isToday: boolean;
  isFuture: boolean;
}): { evaluation: CalendarEvaluation; evaluationNote: string } {
  if (input.isFuture) {
    return {
      evaluation: "upcoming",
      evaluationNote: "Planned; not yet due.",
    };
  }
  if (input.isToday) {
    return {
      evaluation: "today",
      evaluationNote:
        input.completedCount > 0
          ? "Today's session already logged."
          : "Today's active coach plan.",
    };
  }

  const plannedRun = input.plannedType !== "rest";
  if (plannedRun && input.completedCount > 0) {
    return {
      evaluation: "matched",
      evaluationNote: "Completed a run on a planned training day.",
    };
  }
  if (!plannedRun && input.completedCount === 0) {
    return {
      evaluation: "rest_kept",
      evaluationNote: "Rest day kept — no run logged.",
    };
  }
  if (plannedRun && input.completedCount === 0) {
    return {
      evaluation: "missed",
      evaluationNote: "Planned training day with no run logged.",
    };
  }
  return {
    evaluation: "unplanned",
    evaluationNote: "Ran on a scheduled rest day.",
  };
}

export async function getTrainingCalendar(days = 14) {
  await connectMongo();
  const safeDays = Math.min(28, Math.max(7, days));
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - Math.floor(safeDays / 2));
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + safeDays);

  const [activities, suggestion, activeRecs] = await Promise.all([
    Activity.find({
      activityType: "running",
      startedAt: { $gte: start, $lt: end },
    })
      .sort({ startedAt: 1 })
      .lean(),
    getDailySuggestion(),
    Recommendation.find({ status: "active" }).sort({ generatedAt: -1 }).lean(),
  ]);

  const calendar: CalendarDay[] = [];

  for (let i = 0; i < safeDays; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    const completed = activities
      .filter((a) => new Date(a.startedAt).toISOString().slice(0, 10) === key)
      .map((a) => ({
        id: String(a._id),
        name: a.activityName,
        distanceMeters: a.distanceMeters,
        durationSeconds: a.durationSeconds,
      }));

    const isToday = key === todayKey;
    const isFuture = key > todayKey;
    const template = templateForWeekday(d.getUTCDay());
    const planned = isToday
      ? {
          workoutType: suggestion.workoutType,
          title: suggestion.title,
          source: "coach_today" as const,
        }
      : {
          workoutType: template.workoutType,
          title: template.title,
          source: "weekly_template" as const,
        };

    const { evaluation, evaluationNote } = evaluateDay({
      plannedType: planned.workoutType,
      completedCount: completed.length,
      isToday,
      isFuture,
    });

    calendar.push({
      date: key,
      completed,
      planned,
      evaluation,
      evaluationNote,
    });
  }

  const past = calendar.filter(
    (d) =>
      d.evaluation !== "upcoming" &&
      d.evaluation !== "today"
  );
  const summary = {
    matched: past.filter((d) => d.evaluation === "matched").length,
    restKept: past.filter((d) => d.evaluation === "rest_kept").length,
    missed: past.filter((d) => d.evaluation === "missed").length,
    unplanned: past.filter((d) => d.evaluation === "unplanned").length,
    adherencePct:
      past.length === 0
        ? null
        : Math.round(
            ((past.filter(
              (d) =>
                d.evaluation === "matched" || d.evaluation === "rest_kept"
            ).length /
              past.length) *
              100)
          ),
    calculationVersion: "1.0.0",
  };

  return {
    suggestion,
    secondaryInsights: activeRecs.slice(0, 3),
    calendar,
    evaluationSummary: summary,
  };
}
