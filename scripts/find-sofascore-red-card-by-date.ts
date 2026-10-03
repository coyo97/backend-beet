import os from "node:os";
import path from "node:path";

import {
  chromium,
} from "playwright";

type JsonRecord =
  Record<string, unknown>;

function asRecord(
  value: unknown
): JsonRecord | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as JsonRecord;
}

function sleep(
  ms: number
): Promise<void> {
  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );
}

function collectUniqueTournamentIds(
  value: unknown,
  output: Set<number>,
  depth = 0
): void {

  if (
    depth > 15 ||
    value === null ||
    value === undefined
  ) {
    return;
  }

  if (
    Array.isArray(value)
  ) {
    for (
      const item
      of value
    ) {
      collectUniqueTournamentIds(
        item,
        output,
        depth + 1
      );
    }

    return;
  }

  const record =
    asRecord(value);

  if (!record) {
    return;
  }

  /*
   * Forma habitual:
   *
   * tournament.uniqueTournament.id
   */
  const uniqueTournament =
    asRecord(
      record.uniqueTournament
    );

  if (
    typeof uniqueTournament?.id ===
    "number"
  ) {
    output.add(
      uniqueTournament.id
    );
  }

  /*
   * Por si la respuesta usa directamente
   * uniqueTournamentId.
   */
  if (
    typeof record.uniqueTournamentId ===
    "number"
  ) {
    output.add(
      record.uniqueTournamentId
    );
  }

  for (
    const child
    of Object.values(record)
  ) {
    collectUniqueTournamentIds(
      child,
      output,
      depth + 1
    );
  }
}

function collectEvents(
  value: unknown,
  output:
    Map<
      number,
      JsonRecord
    >,
  depth = 0
): void {

  if (
    depth > 15 ||
    value === null ||
    value === undefined
  ) {
    return;
  }

  if (
    Array.isArray(value)
  ) {
    for (
      const item
      of value
    ) {
      collectEvents(
        item,
        output,
        depth + 1
      );
    }

    return;
  }

  const record =
    asRecord(value);

  if (!record) {
    return;
  }

  const home =
    asRecord(
      record.homeTeam
    );

  const away =
    asRecord(
      record.awayTeam
    );

  if (
    typeof record.id ===
      "number" &&
    home &&
    away
  ) {
    output.set(
      record.id,
      record
    );
  }

  for (
    const child
    of Object.values(record)
  ) {
    collectEvents(
      child,
      output,
      depth + 1
    );
  }
}

async function main():
  Promise<void> {

  const date =
    process.argv[2] ??
    "2026-10-02";

  const maxEvents =
    Number(
      process.argv[3] ??
      "150"
    );

  const maxTournamentPages =
    Number(
      process.argv[4] ??
      "5"
    );

  const profileDir =
    path.join(
      os.homedir(),
      ".cache",
      "football-radar",
      "sofascore-profile"
    );

  const context =
    await chromium
      .launchPersistentContext(
        profileDir,
        {
          headless:
            false,

          locale:
            "es-ES",

          timezoneId:
            "America/La_Paz",

          viewport: {
            width:
              1365,

            height:
              900,
          },
        }
      );

  const page =
    context.pages()[0] ??
    await context.newPage();

  try {
    await page.goto(
      "https://www.sofascore.com/es/",
      {
        waitUntil:
          "domcontentloaded",

        timeout:
          30_000,
      }
    );

    await page.waitForTimeout(
      1000
    );

    console.log(
      "PAGE:",
      page.url()
    );

    console.log(
      "DATE:",
      date
    );

    /*
     * ------------------------------------------------
     * STEP 1
     * Descubrir torneos programados para la fecha.
     * ------------------------------------------------
     */

    const tournamentIds =
      new Set<number>();

    for (
      let pageNumber = 1;
      pageNumber <=
        maxTournamentPages;
      pageNumber += 1
    ) {
      const result =
        await page.evaluate(
          async ({
            date,
            pageNumber,
          }) => {

            const response =
              await fetch(
                `/api/v1/sport/football/scheduled-tournaments/${date}/page/${pageNumber}`,
                {
                  credentials:
                    "include",

                  headers: {
                    accept:
                      "application/json",
                  },
                }
              );

            return {
              status:
                response.status,

              body:
                await response.text(),
            };
          },
          {
            date,
            pageNumber,
          }
        );

      console.log(
        `TOURNAMENT PAGE ${pageNumber} HTTP:`,
        result.status
      );

      if (
        result.status !==
        200
      ) {
        break;
      }

      let payload:
        unknown;

      try {
        payload =
          JSON.parse(
            result.body
          );
      } catch {
        console.log(
          "INVALID TOURNAMENT JSON"
        );

        break;
      }

      const before =
        tournamentIds.size;

      collectUniqueTournamentIds(
        payload,
        tournamentIds
      );

      console.log(
        "TOURNAMENT IDS:",
        tournamentIds.size
      );

      /*
       * Si una página no aporta ningún
       * torneo nuevo, dejamos de paginar.
       */
      if (
        tournamentIds.size ===
        before
      ) {
        break;
      }

      await sleep(
        150
      );
    }

    console.log(
      "\nUNIQUE TOURNAMENTS:",
      tournamentIds.size
    );

    console.log(
      Array.from(
        tournamentIds
      )
        .slice(
          0,
          100
        )
        .join(
          ", "
        )
    );

    /*
     * ------------------------------------------------
     * STEP 2
     * Sacar eventos de cada competición.
     * ------------------------------------------------
     */

    const events =
      new Map<
        number,
        JsonRecord
      >();

    let tournamentNumber =
      0;

    for (
      const uniqueTournamentId
      of tournamentIds
    ) {
      tournamentNumber +=
        1;

      console.log(
        `\n[TOURNAMENT ${tournamentNumber}/${tournamentIds.size}]`,
        uniqueTournamentId
      );

      const result =
        await page.evaluate(
          async ({
            id,
            date,
          }) => {

            const response =
              await fetch(
                `/api/v1/unique-tournament/${id}/scheduled-events/${date}`,
                {
                  credentials:
                    "include",

                  headers: {
                    accept:
                      "application/json",
                  },
                }
              );

            return {
              status:
                response.status,

              body:
                await response.text(),
            };
          },
          {
            id:
              uniqueTournamentId,

            date,
          }
        );

      console.log(
        "EVENTS HTTP:",
        result.status
      );

      if (
        result.status !==
        200
      ) {
        await sleep(
          100
        );

        continue;
      }

      try {
        const payload:
          unknown =
          JSON.parse(
            result.body
          );

        const before =
          events.size;

        collectEvents(
          payload,
          events
        );

        console.log(
          "EVENTS ADDED:",
          events.size -
          before
        );

        console.log(
          "TOTAL EVENTS:",
          events.size
        );
      } catch {
        console.log(
          "INVALID EVENT JSON"
        );
      }

      await sleep(
        120
      );
    }

    /*
     * ------------------------------------------------
     * STEP 3
     * Solo partidos terminados.
     * ------------------------------------------------
     */

    const finished =
      Array.from(
        events.values()
      )
        .filter(
          event => {
            const status =
              asRecord(
                event.status
              );

            return (
              status?.type ===
              "finished"
            );
          }
        );

    console.log(
      "\n================================"
    );

    console.log(
      "COLLECTED EVENTS:",
      events.size
    );

    console.log(
      "FINISHED EVENTS:",
      finished.length
    );

    console.log(
      "================================"
    );

    /*
     * ------------------------------------------------
     * STEP 4
     * Consultar incidents hasta encontrar roja.
     * ------------------------------------------------
     */

    let scanned =
      0;

    let totalCards =
      0;

    let totalRedCards =
      0;

    for (
      const event
      of finished
    ) {
      if (
        scanned >=
        maxEvents
      ) {
        break;
      }

      const eventId =
        typeof event.id ===
        "number"
          ? event.id
          : null;

      if (!eventId) {
        continue;
      }

      scanned +=
        1;

      const home =
        asRecord(
          event.homeTeam
        );

      const away =
        asRecord(
          event.awayTeam
        );

      const tournament =
        asRecord(
          event.tournament
        );

      const homeScore =
        asRecord(
          event.homeScore
        );

      const awayScore =
        asRecord(
          event.awayScore
        );

      console.log(
        `\n[EVENT ${scanned}/${Math.min(
          finished.length,
          maxEvents
        )}]`
      );

      console.log(
        "EVENT:",
        eventId
      );

      console.log(
        "MATCH:",
        `${home?.name ?? "?"} vs ${away?.name ?? "?"}`
      );

      console.log(
        "SCORE:",
        `${homeScore?.current ?? "?"}-${awayScore?.current ?? "?"}`
      );

      console.log(
        "TOURNAMENT:",
        tournament?.name ??
        null
      );

      const incidentResult =
        await page.evaluate(
          async (
            id
          ) => {

            const response =
              await fetch(
                `/api/v1/event/${id}/incidents`,
                {
                  credentials:
                    "include",

                  headers: {
                    accept:
                      "application/json",
                  },
                }
              );

            return {
              status:
                response.status,

              body:
                await response.text(),
            };
          },
          eventId
        );

      console.log(
        "INCIDENT HTTP:",
        incidentResult.status
      );

      if (
        incidentResult.status !==
        200
      ) {
        await sleep(
          100
        );

        continue;
      }

      let incidentPayload:
        unknown;

      try {
        incidentPayload =
          JSON.parse(
            incidentResult.body
          );
      } catch {
        continue;
      }

      const root =
        asRecord(
          incidentPayload
        );

      const incidents =
        Array.isArray(
          root?.incidents
        )
          ? root.incidents
          : [];

      const cards =
        incidents
          .map(
            asRecord
          )
          .filter(
            (
              value
            ): value is
              JsonRecord =>
                value !==
                null
          )
          .filter(
            incident =>
              incident.incidentType ===
              "card"
          );

      const reds =
        cards.filter(
          card =>
            String(
              card.incidentClass ??
              ""
            )
              .toLowerCase()
              .includes(
                "red"
              )
        );

      totalCards +=
        cards.length;

      totalRedCards +=
        reds.length;

      console.log(
        "CARDS:",
        cards.length
      );

      console.log(
        "RED CARDS:",
        reds.length
      );

      if (
        cards.length >
        0
      ) {
        console.dir(
          cards.map(
            card => ({
              time:
                card.time ??
                null,

              addedTime:
                card.addedTime ??
                null,

              side:
                card.isHome ===
                true
                  ? "HOME"
                  : card.isHome ===
                    false
                    ? "AWAY"
                    : "UNKNOWN",

              incidentClass:
                card.incidentClass ??
                null,

              player:
                asRecord(
                  card.player
                )?.name ??
                null,

              cardId:
                card.id ??
                null,
            })
          ),
          {
            depth:
              null,
          }
        );
      }

      if (
        reds.length >
        0
      ) {
        console.log(
          "\n================================"
        );

        console.log(
          "🚨🚨🚨 RED CARD CONFIRMED 🚨🚨🚨"
        );

        console.log(
          "================================"
        );

        console.log(
          "EVENT:",
          eventId
        );

        console.log(
          "MATCH:",
          `${home?.name ?? "?"} vs ${away?.name ?? "?"}`
        );

        console.log(
          "TOURNAMENT:",
          tournament?.name ??
          null
        );

        console.dir(
          reds,
          {
            depth:
              null,
          }
        );

        /*
         * Una muestra real es suficiente
         * para validar el formato.
         */
        break;
      }

      await sleep(
        120
      );
    }

    console.log(
      "\n================================"
    );

    console.log(
      "SUMMARY"
    );

    console.log(
      "================================"
    );

    console.log(
      "DATE:",
      date
    );

    console.log(
      "TOURNAMENTS:",
      tournamentIds.size
    );

    console.log(
      "EVENTS:",
      events.size
    );

    console.log(
      "FINISHED:",
      finished.length
    );

    console.log(
      "SCANNED:",
      scanned
    );

    console.log(
      "CARDS FOUND:",
      totalCards
    );

    console.log(
      "RED CARDS FOUND:",
      totalRedCards
    );
  } finally {
    await context.close();
  }
}

void main();
