import {
  Router,
} from "express";

import {
  GetStartingSoonMatches,
} from "../../application/use-cases/GetStartingSoonMatches";

import {
  flashscoreUpcomingShared,
} from "../../infrastructure/providers/flashscore/flashscoreUpcomingShared";

/*
 * Endpoint independiente.
 *
 * No modifica:
 *
 * - /football/live
 * - /radar/red-cards
 * - GetLiveMatches
 * - RedCardDetectedScheduler
 * - Notificaciones push
 */
export function createStartingSoonRouter():
  Router {

  const router =
    Router();

  const getStartingSoon =
    new GetStartingSoonMatches(
      flashscoreUpcomingShared
    );

  router.get(
    "/starting-soon",

    async (req, res) => {

      try {

        const country =
          typeof req.query.country ===
          "string"
            ? req.query.country.trim()
            : "";

        const matches =
          await getStartingSoon.execute();

        /*
         * Filtrar por país sin
         * realizar nuevas consultas.
         */
        const normalize =
          (value: string) =>
            value
              .normalize("NFD")
              .replace(
                /[\u0300-\u036f]/g,
                ""
              )
              .trim()
              .toLowerCase();

        const filtered =
          country
            ? matches.filter(
                match =>
                  normalize(
                    match.competition.country
                  ) === normalize(country)
              )
            : matches;

        return res.status(200).json({
          count: filtered.length,

          filters: {
            country: country || null,
          },

          matches: filtered,
        });

      } catch (error) {

        console.error(
          "[StartingSoon]",
          error
        );

        return res.status(502).json({
          message:
            "Could not retrieve starting soon matches",
        });
      }
    }
  );

  return router;
}

export const startingSoonRouter =
  createStartingSoonRouter();
