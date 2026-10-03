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

function stringValue(
  value: unknown
): string | null {
  return typeof value ===
    "string"
    ? value
    : null;
}

function numberValue(
  value: unknown
): number | null {
  return (
    typeof value ===
      "number" &&
    Number.isFinite(value)
  )
    ? value
    : null;
}

async function main():
  Promise<void> {

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
      1200
    );

    const liveResult =
      await page.evaluate(
        async () => {
          const response =
            await fetch(
              "/api/v1/sport/football/events/live",
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
        }
      );

    console.log(
      "LIVE HTTP:",
      liveResult.status
    );

    if (
      liveResult.status !==
      200
    ) {
      console.log(
        liveResult.body.slice(
          0,
          2000
        )
      );

      return;
    }

    const livePayload:
      unknown =
      JSON.parse(
        liveResult.body
      );

    const root =
      asRecord(
        livePayload
      );

    const events =
      Array.isArray(
        root?.events
      )
        ? root.events
        : [];

    console.log(
      "LIVE EVENTS:",
      events.length
    );

    let totalCards =
      0;

    let totalRedCards =
      0;

    for (
      const value
      of events
    ) {
      const event =
        asRecord(
          value
        );

      if (!event) {
        continue;
      }

      const eventId =
        numberValue(
          event.id
        );

      if (!eventId) {
        continue;
      }

      const home =
        asRecord(
          event.homeTeam
        );

      const away =
        asRecord(
          event.awayTeam
        );

      const status =
        asRecord(
          event.status
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
        "\n================================"
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
        "STATUS:",
        status?.description ??
        status?.type ??
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
        console.log(
          "INVALID INCIDENT JSON"
        );

        continue;
      }

      const incidentRoot =
        asRecord(
          incidentPayload
        );

      const incidents =
        Array.isArray(
          incidentRoot?.incidents
        )
          ? incidentRoot.incidents
          : [];

      const cards =
        incidents
          .map(
            asRecord
          )
          .filter(
            (
              incident
            ): incident is
              JsonRecord =>
                incident !==
                null
          )
          .filter(
            incident =>
              incident
                .incidentType ===
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
        "INCIDENTS:",
        incidents.length
      );

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
        console.log(
          "CARD DETAILS:"
        );

        console.dir(
          cards.map(
            card => ({
              time:
                card.time ??
                null,

              addedTime:
                card.addedTime ??
                null,

              isHome:
                card.isHome ??
                null,

              incidentClass:
                stringValue(
                  card.incidentClass
                ),

              player:
                asRecord(
                  card.player
                )?.name ??
                null,

              id:
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
          "\n🚨 RED CARD FOUND 🚨"
        );

        console.dir(
          reds.map(
            card => ({
              eventId,

              match:
                `${home?.name ?? "?"} vs ${away?.name ?? "?"}`,

              side:
                card.isHome ===
                true
                  ? "HOME"
                  : card.isHome ===
                    false
                    ? "AWAY"
                    : "UNKNOWN",

              time:
                card.time ??
                null,

              incidentClass:
                card.incidentClass ??
                null,

              player:
                asRecord(
                  card.player
                )?.name ??
                null,
            })
          ),
          {
            depth:
              null,
          }
        );
      }
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
      "LIVE EVENTS:",
      events.length
    );

    console.log(
      "TOTAL CARDS:",
      totalCards
    );

    console.log(
      "TOTAL RED CARDS:",
      totalRedCards
    );
  } finally {
    await context.close();
  }
}

void main();
