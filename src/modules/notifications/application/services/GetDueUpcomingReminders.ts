
import {
  UpcomingOpportunityModel,
} from "../../../opportunity-filter/infrastructure/database/models/UpcomingOpportunityModel";

import {
  rankUpcomingReminders,
} from "./RankUpcomingReminders";

import {
  UpcomingReminderModel,
  type UpcomingReminderWindow,
} from "../../infrastructure/database/models/UpcomingReminderModel";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export interface DueUpcomingReminder {
  matchKey: string;
  window: UpcomingReminderWindow;

  title: string;
  body: string;

  homeName: string;
  awayName: string;

  dueAt: Date;
  kickoffAt: Date;

  pointsGap: number;
  positionGap: number;
  dataQuality: number;
}

export interface DueUpcomingRemindersResult {
  scanned: number;
  ready: DueUpcomingReminder[];

  expiredWindow: number;
  invalidOpportunity: number;
  staleContext: number;
}

export class GetDueUpcomingReminders {

  public async execute(
    now = new Date()
  ): Promise<DueUpcomingRemindersResult> {

    const nowMs = now.getTime();

    if (!Number.isFinite(nowMs)) {
      throw new Error(
        "Invalid current date"
      );
    }

    /*
     * Solo recordatorios:
     *
     * - todavía planificados
     * - cuyo dueAt ya llegó
     * - cuyo partido aún no comenzó
     */
    const reminders =
      await UpcomingReminderModel
        .find({
          status: "planned",

          dueAt: {
  $gte: new Date(
    nowMs - HOUR_MS
  ),
  $lte: now,
},

          kickoffAt: {
            $gt: now,
          },

          expiresAt: {
            $gt: now,
          },
        })
        .sort({
  dueAt: -1,
  _id: -1,
})
.limit(500)
        .lean()
        .exec();

    if (reminders.length === 0) {
      return {
        scanned: 0,
        ready: [],
        expiredWindow: 0,
        invalidOpportunity: 0,
        staleContext: 0,
      };
    }

    /*
     * Recuperar las oportunidades
     * en una sola consulta MongoDB.
     *
     * Evita consultar individualmente
     * cada partido.
     */
    const keys = [
      ...new Set(
        reminders.map(
          reminder => reminder.matchKey
        )
      ),
    ];

    const opportunities =
      await UpcomingOpportunityModel
        .find({
          matchKey: {
            $in: keys,
          },
        })
        .lean()
        .exec();

    const byKey =
      new Map(
        opportunities.map(
          opportunity => [
            opportunity.matchKey,
            opportunity,
          ] as const
        )
      );

    const ready:
      DueUpcomingReminder[] = [];

    let expiredWindow = 0;
    let invalidOpportunity = 0;
    let staleContext = 0;

    for (const reminder of reminders) {

      /*
       * Máxima demora permitida:
       *
       * 24h: 60 minutos
       * 60m: 10 minutos
       */
      const maxLateness =
        reminder.window === "24h"
          ? HOUR_MS
          : 10 * MINUTE_MS;

      if (
        nowMs >
        reminder.dueAt.getTime() +
          maxLateness
      ) {
        expiredWindow++;
        continue;
      }

      const opportunity =
        byKey.get(reminder.matchKey);

      if (
        !opportunity ||
        opportunity.level !== "high" ||
        opportunity.dataQuality < 70 ||
        opportunity.expiresAt <= now ||
        opportunity.kickoffAt.getTime() !==
          reminder.kickoffAt.getTime()
      ) {
        invalidOpportunity++;
        continue;
      }

      /*
       * No prepararemos avisos basados
       * en contextos demasiado antiguos.
       *
       * Para 60m exigimos revisión
       * en las últimas 4 horas.
       *
       * Para 24h permitimos hasta
       * 12 horas de antigüedad.
       */
      const maxContextAge =
        reminder.window === "60m"
          ? 4 * HOUR_MS
          : 12 * HOUR_MS;

      const age =
        nowMs -
        opportunity.reviewedAt.getTime();

      if (
        !Number.isFinite(age) ||
        age < 0 ||
        age > maxContextAge
      ) {
        staleContext++;
        continue;
      }

      ready.push({
        matchKey:
          reminder.matchKey,

        window:
          reminder.window,

        title:
          reminder.title,

        body:
          reminder.body,

        homeName:
          reminder.homeName,

        awayName:
          reminder.awayName,

        dueAt:
          reminder.dueAt,

        kickoffAt:
          reminder.kickoffAt,

        pointsGap:
          opportunity.pointsGap,

        positionGap:
          opportunity.positionGap,

        dataQuality:
          opportunity.dataQuality,
      });
    }

return {
  scanned:
    reminders.length,

  ready:
    rankUpcomingReminders(ready),

  expiredWindow,
  invalidOpportunity,
  staleContext,
};
  }
}

