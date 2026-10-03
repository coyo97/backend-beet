import fs from "node:fs/promises";

import {
  SofascoreBrowser,
} from "../src/modules/football/infrastructure/providers/sofascore-browser/SofascoreBrowser";

type JsonRecord =
  Record<
    string,
    unknown
  >;

interface EventCandidate {
  id:
    string | null;

  home:
    string | null;

  away:
    string | null;

  tournamentId:
    string | null;

  tournamentName:
    string | null;

  uniqueTournamentId:
    string | null;

  uniqueTournamentName:
    string | null;

  seasonId:
    string | null;

  seasonName:
    string | null;

  round:
    string | null;
}

function recordValue(
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

  if (
    typeof value ===
      "string"
  ) {
    const trimmed =
      value.trim();

    return trimmed ||
      null;
  }

  if (
    typeof value ===
      "number" &&
    Number.isFinite(
      value
    )
  ) {
    return String(
      value
    );
  }

  return null;
}

function teamName(
  value:
    unknown
): string | null {

  const record =
    recordValue(
      value
    );

  if (!record) {
    return null;
  }

  return stringValue(
    record.name
  );
}

function collectEvents(
  value:
    unknown,

  output:
    Map<
      string,
      EventCandidate
    >,

  depth =
    0
): void {

  if (
    depth >
      15 ||
    value ===
      null ||
    value ===
      undefined
  ) {
    return;
  }

  if (
    Array.isArray(
      value
    )
  ) {
    for (
      const item
      of value
    ) {
      collectEvents(
        item,
        output,
        depth +
          1
      );
    }

    return;
  }

  const record =
    recordValue(
      value
    );

  if (!record) {
    return;
  }

  const home =
    teamName(
      record.homeTeam
    );

  const away =
    teamName(
      record.awayTeam
    );

  const tournament =
    recordValue(
      record.tournament
    );

  if (
    home &&
    away &&
    tournament
  ) {
    const tournamentId =
      stringValue(
        tournament.id
      );

    const tournamentName =
      stringValue(
        tournament.name
      );

    const uniqueTournament =
      recordValue(
        tournament
          .uniqueTournament
      );

    const season =
      recordValue(
        record.season
      );

    const roundInfo =
      recordValue(
        record.roundInfo
      );

    const id =
      stringValue(
        record.id
      );

    const key =
      id ??
      [
        home,
        away,
        tournamentId ??
          tournamentName ??
          "unknown",
      ].join(
        "::"
      );

    output.set(
      key,
      {
        id,

        home,

        away,

        tournamentId,

        tournamentName,

        uniqueTournamentId:
          uniqueTournament
            ? stringValue(
                uniqueTournament.id
              )
            : null,

        uniqueTournamentName:
          uniqueTournament
            ? stringValue(
                uniqueTournament.name
              )
            : null,

        seasonId:
          season
            ? stringValue(
                season.id
              )
            : null,

        seasonName:
          season
            ? (
                stringValue(
                  season.name
                ) ??
                stringValue(
                  season.year
                )
              )
            : null,

        round:
          roundInfo
            ? (
                stringValue(
                  roundInfo.name
                ) ??
                stringValue(
                  roundInfo.round
                )
              )
            : null,
      }
    );
  }

  for (
    const child
    of Object.values(
      record
    )
  ) {
    collectEvents(
      child,
      output,
      depth +
        1
    );
  }
}

function relevant(
  event:
    EventCandidate
): boolean {

  const text =
    [
      event.home,
      event.away,
      event.tournamentName,
      event.uniqueTournamentName,
    ]
      .filter(
        Boolean
      )
      .join(
        " "
      )
      .toLowerCase();

  return (
    text.includes(
      "guangdong"
    ) ||
    text.includes(
      "wuhan"
    ) ||
    text.includes(
      "cmcl"
    )
  );
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
      "npx tsx scripts/inspect-sofascore-event-next-data.ts URL"
    );

    process.exitCode =
      1;

    return;
  }

  const browser =
    new SofascoreBrowser();

  try {
    const page =
      await browser
        .getPage();

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
      1200
    );

    console.log(
      "TITLE:"
    );

    console.log(
      await page.title()
    );

    console.log(
      "\nURL:"
    );

    console.log(
      page.url()
    );

    const nextData =
      page.locator(
        "script#__NEXT_DATA__"
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
        "Sofascore __NEXT_DATA__ is empty"
      );
    }

    const payload:
      unknown =
      JSON.parse(
        raw
      );

    await fs.writeFile(
      "/tmp/sofascore-event-next-data.json",
      JSON.stringify(
        payload,
        null,
        2
      ),
      "utf8"
    );

    const events =
      new Map<
        string,
        EventCandidate
      >();

    collectEvents(
      payload,
      events
    );

    const all =
      Array.from(
        events.values()
      );

    const matches =
      all.filter(
        relevant
      );

    console.log(
      "\nTOTAL EVENT OBJECTS:",
      all.length
    );

    console.log(
      "RELEVANT EVENT OBJECTS:",
      matches.length
    );

    console.log(
      "\n=============================="
    );

    console.log(
      "RELEVANT EVENTS"
    );

    console.log(
      "=============================="
    );

    for (
      const event
      of matches
    ) {
      console.dir(
        event,
        {
          depth:
            null,
        }
      );
    }

    console.log(
      "\nSAVED:"
    );

    console.log(
      "/tmp/sofascore-event-next-data.json"
    );
  } finally {
    await browser.stop();
  }
}

void main();
