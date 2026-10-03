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

  homeId:
    string | null;

  homeName:
    string | null;

  awayId:
    string | null;

  awayName:
    string | null;

  homeGoals:
    number | null;

  awayGoals:
    number | null;

  status:
    string | null;

  timestamp:
    number | null;

  tournament:
    string | null;
}

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

  if (
    typeof value ===
      "string"
  ) {
    const result =
      value.trim();

    return result ||
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

function numberValue(
  value:
    unknown
): number | null {

  if (
    typeof value ===
      "number" &&
    Number.isFinite(
      value
    )
  ) {
    return value;
  }

  return null;
}

function teamData(
  value:
    unknown
): {
  id:
    string | null;

  name:
    string | null;
} {

  const team =
    asRecord(
      value
    );

  return {
    id:
      stringValue(
        team?.id
      ),

    name:
      stringValue(
        team?.name
      ),
  };
}

function scoreValue(
  value:
    unknown
): number | null {

  const score =
    asRecord(
      value
    );

  if (!score) {
    return null;
  }

  return (
    numberValue(
      score.current
    ) ??
    numberValue(
      score.normaltime
    ) ??
    numberValue(
      score.display
    )
  );
}

function tournamentName(
  event:
    JsonRecord
): string | null {

  const tournament =
    asRecord(
      event.tournament
    );

  const unique =
    asRecord(
      tournament
        ?.uniqueTournament
    );

  return (
    stringValue(
      unique?.name
    ) ??
    stringValue(
      tournament?.name
    )
  );
}

function eventStatus(
  event:
    JsonRecord
): string | null {

  const status =
    asRecord(
      event.status
    );

  return (
    stringValue(
      status?.type
    ) ??
    stringValue(
      status?.description
    )
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
      20 ||
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
      const child
      of value
    ) {
      collectEvents(
        child,
        output,
        depth +
          1
      );
    }

    return;
  }

  const record =
    asRecord(
      value
    );

  if (!record) {
    return;
  }

  const home =
    teamData(
      record.homeTeam
    );

  const away =
    teamData(
      record.awayTeam
    );

  if (
    home.id &&
    away.id &&
    home.name &&
    away.name
  ) {
    const id =
      stringValue(
        record.id
      );

    const key =
      id ??
      [
        home.id,
        away.id,
        stringValue(
          record.startTimestamp
        ),
      ].join(
        ":"
      );

    output.set(
      key,
      {
        id,

        homeId:
          home.id,

        homeName:
          home.name,

        awayId:
          away.id,

        awayName:
          away.name,

        homeGoals:
          scoreValue(
            record.homeScore
          ),

        awayGoals:
          scoreValue(
            record.awayScore
          ),

        status:
          eventStatus(
            record
          ),

        timestamp:
          numberValue(
            record.startTimestamp
          ),

        tournament:
          tournamentName(
            record
          ),
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

function formatDate(
  timestamp:
    number | null
): string {

  if (!timestamp) {
    return "-";
  }

  return new Date(
    timestamp *
      1000
  )
    .toISOString();
}

async function main():
  Promise<void> {

  const teamId =
    process.argv[2];

  const url =
    process.argv[3];

  if (
    !teamId ||
    !url
  ) {
    console.error(
      "Usage:"
    );

    console.error(
      "npx tsx scripts/inspect-sofascore-team-recent.ts TEAM_ID URL"
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

    const payload:
      unknown =
      JSON.parse(
        raw
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

    const relevant =
      Array.from(
        events.values()
      )
        .filter(
          (
            event
          ) =>
            event.homeId ===
              teamId ||
            event.awayId ===
              teamId
        )
        .sort(
          (
            a,
            b
          ) =>
            (
              b.timestamp ??
              0
            ) -
            (
              a.timestamp ??
              0
            )
        );

    console.log(
      "\nTOTAL EVENTS:",
      events.size
    );

    console.log(
      "TEAM EVENTS:",
      relevant.length
    );

    console.log(
      "\n=============================="
    );

    console.log(
      "TEAM MATCHES"
    );

    console.log(
      "=============================="
    );

    for (
      const event
      of relevant.slice(
        0,
        15
      )
    ) {
      console.log(
        "\n",
        event.homeName,
        event.homeGoals,
        "-",
        event.awayGoals,
        event.awayName
      );

      console.log(
        "id:",
        event.id
      );

      console.log(
        "status:",
        event.status
      );

      console.log(
        "date:",
        formatDate(
          event.timestamp
        )
      );

      console.log(
        "tournament:",
        event.tournament
      );
    }
  } finally {
    await browser.stop();
  }
}

void main();
