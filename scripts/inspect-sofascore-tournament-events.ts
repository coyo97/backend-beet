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
    string;

  homeId:
    string;

  homeName:
    string;

  awayId:
    string;

  awayName:
    string;

  homeGoals:
    number | null;

  awayGoals:
    number | null;

  statusType:
    string | null;

  statusDescription:
    string | null;

  startTimestamp:
    number | null;

  tournamentId:
    string | null;

  tournamentName:
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

  return value as JsonRecord;
}

function stringValue(
  value:
    unknown
): string | null {

  if (
    typeof value ===
      "string"
  ) {
    return value.trim() ||
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

function getScore(
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
      25 ||
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
        depth + 1
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

  const homeId =
    stringValue(
      home?.id
    );

  const awayId =
    stringValue(
      away?.id
    );

  const homeName =
    stringValue(
      home?.name
    );

  const awayName =
    stringValue(
      away?.name
    );

  if (
    id &&
    homeId &&
    awayId &&
    homeName &&
    awayName
  ) {
    const status =
      asRecord(
        record.status
      );

    const tournament =
      asRecord(
        record.tournament
      );

    output.set(
      id,
      {
        id,

        homeId,
        homeName,

        awayId,
        awayName,

        homeGoals:
          getScore(
            record.homeScore
          ),

        awayGoals:
          getScore(
            record.awayScore
          ),

        statusType:
          stringValue(
            status?.type
          ),

        statusDescription:
          stringValue(
            status?.description
          ),

        startTimestamp:
          numberValue(
            record.startTimestamp
          ),

        tournamentId:
          stringValue(
            tournament?.id
          ),

        tournamentName:
          stringValue(
            tournament?.name
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
      depth + 1
    );
  }
}

function resultForTeam(
  event:
    EventCandidate,

  teamId:
    string
):
  "W" |
  "D" |
  "L" |
  null {

  if (
    event.homeGoals ===
      null ||
    event.awayGoals ===
      null
  ) {
    return null;
  }

  const isHome =
    event.homeId ===
      teamId;

  const goalsFor =
    isHome
      ? event.homeGoals
      : event.awayGoals;

  const goalsAgainst =
    isHome
      ? event.awayGoals
      : event.homeGoals;

  if (
    goalsFor >
      goalsAgainst
  ) {
    return "W";
  }

  if (
    goalsFor <
      goalsAgainst
  ) {
    return "L";
  }

  return "D";
}

function printTeam(
  teamId:
    string,

  teamName:
    string,

  events:
    EventCandidate[]
): void {

  const matches =
    events
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
            b.startTimestamp ??
            0
          ) -
          (
            a.startTimestamp ??
            0
          )
      );

  console.log(
    "\n================================"
  );

  console.log(
    teamName
  );

  console.log(
    "EVENTS:",
    matches.length
  );

  console.log(
    "================================"
  );

  for (
    const event
    of matches.slice(
      0,
      20
    )
  ) {
    const isHome =
      event.homeId ===
        teamId;

    const opponent =
      isHome
        ? event.awayName
        : event.homeName;

    const result =
      resultForTeam(
        event,
        teamId
      );

    console.log({
      id:
        event.id,

      result,

      opponent,

      homeAway:
        isHome
          ? "home"
          : "away",

      score:
        `${event.homeGoals ?? "-"}-${event.awayGoals ?? "-"}`,

      status:
        event.statusType,

      tournamentId:
        event.tournamentId,

      tournament:
        event.tournamentName,

      date:
        event.startTimestamp
          ? new Date(
              event.startTimestamp *
                1000
            )
              .toISOString()
          : null,
    });
  }
}

async function main():
  Promise<void> {

  const browser =
    new SofascoreBrowser();

  try {
    const page =
      await browser
        .getPage();

    const url =
      "https://www.sofascore.com/football/tournament/china/cmcl-champions-league/35616#id:96779";

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
      1500
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
        "Sofascore __NEXT_DATA__ empty"
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

    const all =
      Array.from(
        events.values()
      );

    console.log(
      "TOTAL UNIQUE EVENTS:",
      all.length
    );

    printTeam(
      "1233111",
      "Guangdong Chenxing Juli",
      all
    );

    printTeam(
      "1079261",
      "Wuhan Lianzhen FC",
      all
    );
  } finally {
    await browser.stop();
  }
}

void main();
