import fs from "node:fs/promises";

import {
  SofascoreBrowser,
} from "../src/modules/football/infrastructure/providers/sofascore-browser/SofascoreBrowser";

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

  if (
    typeof value === "string"
  ) {
    return value;
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return String(value);
  }

  return null;
}

function collectEvents(
  value: unknown,
  result: Map<string, JsonRecord>,
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
        result,
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

  const id =
    stringValue(
      record.id
    );

  if (
    id &&
    home &&
    away
  ) {
    result.set(
      id,
      record
    );
  }

  for (
    const child
    of Object.values(record)
  ) {
    collectEvents(
      child,
      result,
      depth + 1
    );
  }
}

function interestingFields(
  value: unknown,
  path = "event",
  depth = 0,
  result: Record<string, unknown> = {}
): Record<string, unknown> {

  if (
    depth > 6 ||
    value === null ||
    value === undefined
  ) {
    return result;
  }

  if (
    Array.isArray(value)
  ) {
    value
      .slice(0, 20)
      .forEach(
        (
          item,
          index
        ) => {
          interestingFields(
            item,
            `${path}[${index}]`,
            depth + 1,
            result
          );
        }
      );

    return result;
  }

  const record =
    asRecord(value);

  if (!record) {
    return result;
  }

  for (
    const [
      key,
      child,
    ]
    of Object.entries(record)
  ) {
    const childPath =
      `${path}.${key}`;

    if (
      /red|card|incident|minute|period|time|status/i
        .test(key)
    ) {
      if (
        child === null ||
        typeof child === "string" ||
        typeof child === "number" ||
        typeof child === "boolean"
      ) {
        result[
          childPath
        ] =
          child;
      }
    }

    interestingFields(
      child,
      childPath,
      depth + 1,
      result
    );
  }

  return result;
}

function describe(
  event: JsonRecord
): JsonRecord {

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

  const tournament =
    asRecord(
      event.tournament
    );

  const uniqueTournament =
    asRecord(
      tournament
        ?.uniqueTournament
    );

  const season =
    asRecord(
      event.season
    );

  const homeScore =
    asRecord(
      event.homeScore
    );

  const awayScore =
    asRecord(
      event.awayScore
    );

  return {
    id:
      event.id ?? null,

    customId:
      event.customId ?? null,

    home:
      home?.name ?? null,

    homeSlug:
      home?.slug ?? null,

    away:
      away?.name ?? null,

    awaySlug:
      away?.slug ?? null,

    homeScore:
      homeScore?.current ??
      null,

    awayScore:
      awayScore?.current ??
      null,

    statusType:
      status?.type ??
      null,

    statusDescription:
      status?.description ??
      null,

    tournamentId:
      tournament?.id ??
      null,

    tournament:
      tournament?.name ??
      null,

    uniqueTournamentId:
      uniqueTournament?.id ??
      null,

    uniqueTournament:
      uniqueTournament?.name ??
      null,

    seasonId:
      season?.id ??
      null,

    season:
      season?.name ??
      null,

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

async function main():
  Promise<void> {

  const browser =
    new SofascoreBrowser();

  try {
    const page =
      await browser.getPage();

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
      2000
    );

    console.log(
      "TITLE:",
      await page.title()
    );

    console.log(
      "URL:",
      page.url()
    );

    const nextData =
      page.locator(
        "script#__NEXT_DATA__"
      );

    console.log(
      "NEXT_DATA COUNT:",
      await nextData.count()
    );

    await nextData.waitFor({
      state:
        "attached",

      timeout:
        15_000,
    });

    const raw =
      await nextData
        .textContent();

    if (!raw) {
      throw new Error(
        "__NEXT_DATA__ empty"
      );
    }

    await fs.writeFile(
      "/tmp/sofascore-home-next-data.json",
      raw,
      "utf8"
    );

    const payload:
      unknown =
      JSON.parse(raw);

    const events =
      new Map<
        string,
        JsonRecord
      >();

    collectEvents(
      payload,
      events
    );

    console.log(
      "\nTOTAL EVENT OBJECTS:",
      events.size
    );

    const statusCounts =
      new Map<
        string,
        number
      >();

    for (
      const event
      of events.values()
    ) {
      const status =
        asRecord(
          event.status
        );

      const type =
        stringValue(
          status?.type
        ) ??
        "unknown";

      statusCounts.set(
        type,
        (
          statusCounts.get(type) ??
          0
        ) + 1
      );
    }

    console.log(
      "\nSTATUS TYPES:"
    );

    console.dir(
      Object.fromEntries(
        statusCounts
      ),
      {
        depth:
          null,
      }
    );

    const live =
      Array
        .from(
          events.values()
        )
        .filter(
          event => {

            const status =
              asRecord(
                event.status
              );

            const type =
              stringValue(
                status?.type
              )
                ?.toLowerCase();

            return (
              type === "inprogress" ||
              type === "live" ||
              type === "halftime" ||
              type === "paused"
            );
          }
        );

    console.log(
      "\n=============================="
    );

    console.log(
      "LIVE-LIKE EVENTS:",
      live.length
    );

    console.log(
      "=============================="
    );

    live.forEach(
      (
        event,
        index
      ) => {

        console.log(
          `\n--- LIVE ${index + 1} ---`
        );

        console.dir(
          describe(event),
          {
            depth:
              null,
          }
        );

        const fields =
          interestingFields(
            event
          );

        if (
          Object.keys(fields)
            .length >
          0
        ) {
          console.log(
            "CARD/TIME FIELDS:"
          );

          console.dir(
            fields,
            {
              depth:
                null,
            }
          );
        }
      }
    );

    console.log(
      "\nSAVED:"
    );

    console.log(
      "/tmp/sofascore-home-next-data.json"
    );
  } finally {
    await browser.stop();
  }
}

void main();
