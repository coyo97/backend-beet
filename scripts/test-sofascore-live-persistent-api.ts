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
            width: 1365,
            height: 900,
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
      1500
    );

    console.log(
      "PAGE:",
      page.url()
    );

    const result =
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

            ok:
              response.ok,

            body:
              await response.text(),
          };
        }
      );

    console.log(
      "STATUS:",
      result.status
    );

    console.log(
      "OK:",
      result.ok
    );

    if (
      !result.ok
    ) {
      console.log(
        "BODY:",
        result.body.slice(
          0,
          2000
        )
      );

      return;
    }

    const payload:
      unknown =
      JSON.parse(
        result.body
      );

    const root =
      asRecord(
        payload
      );

    const events =
      Array.isArray(
        root?.events
      )
        ? root.events
        : [];

    console.log(
      "EVENTS:",
      events.length
    );

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

      const tournament =
        asRecord(
          event.tournament
        );

      console.log(
        "\n------------------------------"
      );

      console.dir(
        {
          id:
            event.id ??
            null,

          customId:
            event.customId ??
            null,

          home:
            home?.name ??
            null,

          away:
            away?.name ??
            null,

          score: [
            homeScore?.current ??
              null,

            awayScore?.current ??
              null,
          ],

          status:
            status?.type ??
            null,

          description:
            status?.description ??
            null,

          tournament:
            tournament?.name ??
            null,

          homeRedCards:
            event.homeRedCards ??
            null,

          awayRedCards:
            event.awayRedCards ??
            null,
        },
        {
          depth:
            null,
        }
      );
    }
  } finally {
    await context.close();
  }
}

void main();
