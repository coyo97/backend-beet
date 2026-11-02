
import {
  UpcomingOpportunityModel,
} from "../../../opportunity-filter/infrastructure/database/models/UpcomingOpportunityModel";

import {
  UpcomingReminderModel,
  type UpcomingReminderWindow,
} from "../../infrastructure/database/models/UpcomingReminderModel";

const MINUTE_MS =
  60 * 1000;

const HOUR_MS =
  60 * MINUTE_MS;

interface WindowConfig {
  window: UpcomingReminderWindow;
  leadMs: number;
  maxLatenessMs: number;
}

const WINDOWS: WindowConfig[] = [
  {
    window: "24h",
    leadMs: 24 * HOUR_MS,
    maxLatenessMs: 60 * MINUTE_MS,
  },
  {
    window: "60m",
    leadMs: HOUR_MS,
    maxLatenessMs: 10 * MINUTE_MS,
  },
];

export interface UpcomingReminderPlanResult {
  opportunitiesRead: number;
  eligible: number;

  created: number;
  existing: number;

  skipped: number;
}

export class PlanUpcomingReminders {

  /*
   * Este servicio solo planifica.
   *
   * NO envía push.
   * NO cambia status a sent.
   * NO selecciona dispositivos.
   */
  public async execute(
    now = new Date()
  ): Promise<UpcomingReminderPlanResult> {

    const nowMs =
      now.getTime();

    if (!Number.isFinite(nowMs)) {
      throw new Error(
        "Invalid planning date"
      );
    }

    const horizon =
      new Date(
        nowMs + 48 * HOUR_MS
      );

    /*
     * Leer oportunidades persistidas.
     *
     * No necesitamos volver
     * a llamar a Flashscore.
     */
    const opportunities =
      await UpcomingOpportunityModel
        .find({
          kickoffAt: {
            $gt: now,
            $lte: horizon,
          },
          expiresAt: {
            $gt: now,
          },
        })
        .sort({
          kickoffAt: 1,
        })
        .limit(5000)
        .lean()
        .exec();

    let eligible = 0;
    let created = 0;
    let existing = 0;
    let skipped = 0;

    for (const opportunity of opportunities) {

      /*
       * Política inicial:
       * únicamente prioridad alta
       * con calidad suficiente.
       */
      if (
        opportunity.level !== "high" ||
        opportunity.dataQuality < 70
      ) {
        skipped++;
        continue;
      }

      const kickoffMs =
        opportunity.kickoffAt
          .getTime();

      if (
        !Number.isFinite(kickoffMs) ||
        kickoffMs <= nowMs
      ) {
        skipped++;
        continue;
      }

      eligible++;

      for (const config of WINDOWS) {

        const dueMs =
          kickoffMs -
          config.leadMs;

        /*
         * No generar una alerta
         * de 24 horas cuando solo
         * faltan, por ejemplo,
         * cuatro horas.
         *
         * Tolerancias:
         * 24h -> hasta 60min tarde
         * 60m -> hasta 10min tarde
         */
        if (
          nowMs >
          dueMs + config.maxLatenessMs
        ) {
          skipped++;
          continue;
        }

        const homeText =
          `${opportunity.homeName} ` +
          `(${opportunity.homePosition}.º, ` +
          `${opportunity.homePoints} pts)`;

        const awayText =
          `${opportunity.awayName} ` +
          `(${opportunity.awayPosition}.º, ` +
          `${opportunity.awayPoints} pts)`;

        const title =
          config.window === "24h"
            ? "⚽ Partido destacado para mañana"
            : "⚽ Partido destacado: falta 1 hora";

        const body =
          `${homeText} vs ${awayText}. ` +
          `Diferencia: ${opportunity.pointsGap} ` +
          `puntos y ${opportunity.positionGap} ` +
          `posiciones. Revisa el contexto.`;

        /*
         * No reiniciar el estado
         * cuando el documento existe.
         *
         * Si está marcado como
         * enviado, seguirá enviado.
         */
        const result =
          await UpcomingReminderModel
            .updateOne(
              {
                matchKey:
                  opportunity.matchKey,

                window:
                  config.window,
              },
              {
                $set: {
                  kickoffAt:
                    opportunity.kickoffAt,

                  dueAt:
                    new Date(dueMs),

                  expiresAt:
                    new Date(
                      kickoffMs +
                      48 * HOUR_MS
                    ),

                  title,
                  body,

                  homeName:
                    opportunity.homeName,

                  awayName:
                    opportunity.awayName,

                  pointsGap:
                    opportunity.pointsGap,

                  positionGap:
                    opportunity.positionGap,

                  dataQuality:
                    opportunity.dataQuality,
                },

                $setOnInsert: {
                  status: "planned",
                  sentAt: null,
                },
              },
              {
                upsert: true,
              }
            )
            .exec();

        if (
          result.upsertedCount > 0
        ) {
          created++;
        } else {
          existing++;
        }
      }
    }

    return {
      opportunitiesRead:
        opportunities.length,

      eligible,
      created,
      existing,
      skipped,
    };
  }
}

