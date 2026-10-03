import fs from "node:fs";

import {
  SofascoreBrowser,
} from "../src/modules/football/infrastructure/providers/sofascore-browser/SofascoreBrowser";

type JsonRecord =
  Record<
    string,
    unknown
  >;

function asRecord(
  value:
    unknown
): JsonRecord | null {

  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    return null;
  }

  return value as
    JsonRecord;
}

function stringValue(
  value:
    unknown
): string | null {

  return typeof value ===
    "string"
    ? value
    : null;
}

function numberValue(
  value:
    unknown
): number | null {

  return typeof value ===
      "number" &&
    Number.isFinite(
      value
    )
    ? value
    : null;
}

function describeEvent(
  value:
    unknown
): JsonRecord {

  const event =
    asRecord(
      value
    ) ??
    {};

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

  const uniqueTournament =
    asRecord(
      tournament
        ?.uniqueTournament
    );

  return {
    id:
      event.id ??
      null,

    home:
      stringValue(
        home?.name
      ),

    away:
      stringValue(
        away?.name
      ),

    score:
      [
        numberValue(
          homeScore?.current
        ),

        numberValue(
          awayScore?.current
        ),
      ],

    statusType:
      stringValue(
        status?.type
      ),

    statusDescription:
      stringValue(
        status?.description
      ),

    tournament:
      stringValue(
        tournament?.name
      ),

    uniqueTournament:
      stringValue(
        uniqueTournament?.name
      ),

    startTimestamp:
      event.startTimestamp ??
      null,

    homeRedCards:
      event.homeRedCards ??
      null,

    awayRedCards:
      event.awayRedCards ??
      null,
  };
}

function collectInterestingFields(
  value:
    unknown,

  path =
    "event",

  depth =
    0,

  result:
    Record<
      string,
      unknown
    > =
      {}
): Record<
  string,
  unknown
> {

  if (
    depth >
    5 ||
    value ===
      null ||
    value ===
      undefined
  ) {
    return result;
  }

  if (
    Array.isArray(
      value
    )
  ) {
    value
      .slice(
        0,
        10
      )
      .forEach(
        (
          item,
          index
        ) => {

          collectInterestingFields(
            item,
            `${path}[${index}]`,
            depth + 1,
            result
          );
        }
      );

    return result;
  }

  if (
    typeof value !==
    "object"
  ) {
    return result;
  }

  for (
    const [
      key,
      item,
    ]
    of Object.entries(
      value as
        JsonRecord
    )
  ) {
    const itemPath =
      `${path}.${key}`;

    if (
      /red|card|minute|period|time/i
        .test(
          key
        )
    ) {
      result[
        itemPath
      ] =
        item;
    }

    collectInterestingFields(
      item,
      itemPath,
      depth + 1,
      result
    );
  }

  return result;
}

async function main():
  Promise<void> {

  const browser =
    new SofascoreBrowser();

  try {
    const page =
      await browser
        .getPage();

    /*
     * Primero entramos normalmente
     * a Sofascore para establecer
     * la sesión del navegador.
     */
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

    /*
     * La petición ocurre DENTRO de
     * la página real, mismo origen,
     * mismas cookies/sesión.
     */
    const response =
      await page.evaluate(
        async () => {

          const result =
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
              result.status,

            ok:
              result.ok,

            contentType:
              result.headers.get(
                "content-type"
              ),

            body:
              await result.text(),
          };
        }
      );

    console.log(
      "STATUS:",
      response.status
    );

    console.log(
      "OK:",
      response.ok
    );

    console.log(
      "CONTENT-TYPE:",
      response.contentType
    );

    if (
      !response.ok
    ) {
      console.log(
        "\nBODY:\n",
        response.body.slice(
          0,
          2000
        )
      );

      return;
    }

    let payload:
      unknown;

    try {
      payload =
        JSON.parse(
          response.body
        );
    } catch (
      error
    ) {
      console.error(
        "JSON parse failed:",
        error
      );

      console.log(
        response.body.slice(
          0,
          2000
        )
      );

      return;
    }

    fs.writeFileSync(
      "/tmp/sofascore-live.json",
      JSON.stringify(
        payload,
        null,
        2
      ),
      "utf8"
    );

    console.log(
      "SAVED:",
      "/tmp/sofascore-live.json"
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
      "\nTOTAL EVENTS:",
      events.length
    );

    const statuses =
      new Map<
        string,
        number
      >();

    for (
      const value
      of events
    ) {
      const event =
        asRecord(
          value
        );

      const status =
        asRecord(
          event?.status
        );

      const type =
        stringValue(
          status?.type
        ) ??
        "unknown";

      statuses.set(
        type,
        (
          statuses.get(
            type
          ) ??
          0
        ) +
        1
      );
    }

    console.log(
      "\n===== STATUS TYPES ====="
    );

    console.dir(
      Object.fromEntries(
        statuses
      ),
      {
        depth:
          null,
      }
    );

    console.log(
      "\n===== FIRST 20 ====="
    );

    console.dir(
      events
        .slice(
          0,
          20
        )
        .map(
          describeEvent
        ),
      {
        depth:
          null,
      }
    );

    /*
     * Buscamos candidatos que ya
     * contengan datos explícitos
     * relacionados con tarjetas.
     */
    console.log(
      "\n===== CARD / TIME FIELDS ====="
    );

    let inspected =
      0;

    for (
      const value
      of events
    ) {
      const fields =
        collectInterestingFields(
          value
        );

      const keys =
        Object.keys(
          fields
        );

      if (
        keys.length ===
        0
      ) {
        continue;
      }

      console.log(
        "\nEVENT:",
        describeEvent(
          value
        )
      );

      console.dir(
        fields,
        {
          depth:
            null,
        }
      );

      inspected +=
        1;

      if (
        inspected >=
        5
      ) {
        break;
      }
    }
  } finally {
    await browser.stop();
  }
}

void main();
