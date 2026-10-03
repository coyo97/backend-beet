import fs from "node:fs";
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

function teamName(
  value: unknown
): string | null {
  const record =
    asRecord(value);

  return record
    ? stringValue(
        record.name
      )
    : null;
}

function collectEvents(
  value: unknown,

  output:
    Map<
      string,
      JsonRecord
    >,

  depth = 0
): void {

  if (
    depth > 20 ||
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
    home &&
    away
  ) {
    const id =
      stringValue(
        record.id
      ) ??
      `${home.name}-${away.name}`;

    output.set(
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
      output,
      depth + 1
    );
  }
}

function printInterestingFields(
  value: unknown,

  pathName = "$",

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
    value.forEach(
      (
        item,
        index
      ) => {
        printInterestingFields(
          item,
          `${pathName}[${index}]`,
          depth + 1
        );
      }
    );

    return;
  }

  const record =
    asRecord(value);

  if (!record) {
    return;
  }

  for (
    const [
      key,
      child,
    ]
    of Object.entries(record)
  ) {
    const childPath =
      `${pathName}.${key}`;

    if (
      /red|card|yellow|incident|standing|position|points|matches|wins|draws|losses|season|tournament|round/i
        .test(key)
    ) {
      let printable:
        unknown =
        child;

      if (
        child &&
        typeof child === "object"
      ) {
        try {
          const serialized =
            JSON.stringify(
              child
            );

          printable =
            serialized.length >
            1200
              ? `${serialized.slice(
                  0,
                  1200
                )}...`
              : child;
        } catch {
          printable =
            "[object]";
        }
      }

      console.log(
        childPath,
        "="
      );

      console.dir(
        printable,
        {
          depth: 5,
        }
      );
    }

    printInterestingFields(
      child,
      childPath,
      depth + 1
    );
  }
}

function describeEvent(
  event:
    JsonRecord
): JsonRecord {

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

  return {
    id:
      event.id ??
      null,

    home:
      teamName(
        event.homeTeam
      ),

    away:
      teamName(
        event.awayTeam
      ),

    homeScore:
      homeScore?.current ??
      null,

    awayScore:
      awayScore?.current ??
      null,

    status:
      status?.type ??
      null,

    statusDescription:
      status?.description ??
      null,

    tournamentId:
      tournament?.id ??
      null,

    tournamentName:
      tournament?.name ??
      null,

    uniqueTournamentId:
      uniqueTournament?.id ??
      null,

    uniqueTournamentName:
      uniqueTournament?.name ??
      null,

    seasonId:
      season?.id ??
      null,

    seasonName:
      season?.name ??
      null,

    homeRedCards:
      event.homeRedCards ??
      null,

    awayRedCards:
      event.awayRedCards ??
      null,

    roundInfo:
      event.roundInfo ??
      null,
  };
}

async function main():
  Promise<void> {

  const url =
    process.argv[2];

  if (!url) {
    console.error(
      "Usage:"
    );

    console.error(
      'npx tsx scripts/inspect-sofascore-event-persistent.ts "URL"'
    );

    process.exitCode =
      1;

    return;
  }

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
      url,
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

    if (
      page.url()
        .includes(
          "/captcha"
        )
    ) {
      throw new Error(
        "Sofascore CAPTCHA/challenge detected even with persistent profile"
      );
    }

    const nextData =
      page.locator(
        "script#__NEXT_DATA__"
      );

    console.log(
      "NEXT_DATA:",
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

    fs.writeFileSync(
      "/tmp/sofascore-event-next-data.json",
      raw,
      "utf8"
    );

    console.log(
      "RAW SIZE:",
      raw.length
    );

    console.log(
      "\n===== RAW KEYWORDS ====="
    );

    for (
      const word
      of [
        "red",
        "card",
        "yellow",
        "incident",
        "standings",
        "position",
        "points",
        "season",
        "tournament",
      ]
    ) {
      const matches =
        raw.match(
          new RegExp(
            word,
            "gi"
          )
        );

      console.log(
        word,
        matches?.length ??
        0
      );
    }

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
      "\nEVENT OBJECTS:",
      events.size
    );

    for (
      const event
      of events.values()
    ) {
      console.log(
        "\n=============================="
      );

      console.log(
        "EVENT"
      );

      console.log(
        "=============================="
      );

      console.dir(
        describeEvent(
          event
        ),
        {
          depth:
            null,
        }
      );
    }

    console.log(
      "\n=============================="
    );

    console.log(
      "INTERESTING FIELDS"
    );

    console.log(
      "=============================="
    );

    printInterestingFields(
      payload
    );

    console.log(
      "\nSAVED:"
    );

    console.log(
      "/tmp/sofascore-event-next-data.json"
    );
  } finally {
    await context.close();
  }
}

void main();
