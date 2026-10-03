import fs from "node:fs/promises";

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

function asString(
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
    asRecord(
      value
    );

  if (!record) {
    return null;
  }

  return asString(
    record.name
  );
}

function looksLikeStandingRow(
  value:
    unknown
): boolean {

  const record =
    asRecord(
      value
    );

  if (!record) {
    return false;
  }

  const team =
    asRecord(
      record.team
    );

  if (!team) {
    return false;
  }

  return (
    record.position !==
      undefined ||
    record.points !==
      undefined ||
    record.matches !==
      undefined ||
    record.wins !==
      undefined
  );
}

function summarizeRecord(
  record:
    JsonRecord
): JsonRecord {

  const result:
    JsonRecord =
    {};

  const interestingKeys =
    [
      "id",
      "name",
      "type",
      "description",
      "groupName",
      "group",
      "slug",
      "standingsType",
      "tableName",
      "currentRound",
    ];

  for (
    const key
    of interestingKeys
  ) {
    if (
      record[key] !==
        undefined
    ) {
      result[key] =
        record[key];
    }
  }

  const tournament =
    asRecord(
      record.tournament
    );

  if (tournament) {
    result.tournament =
      {
        id:
          tournament.id,

        name:
          tournament.name,
      };
  }

  const uniqueTournament =
    asRecord(
      record.uniqueTournament
    );

  if (uniqueTournament) {
    result.uniqueTournament =
      {
        id:
          uniqueTournament.id,

        name:
          uniqueTournament.name,
      };
  }

  const season =
    asRecord(
      record.season
    );

  if (season) {
    result.season =
      {
        id:
          season.id,

        name:
          season.name,
        year:
          season.year,
      };
  }

  return result;
}

function printRows(
  rows:
    unknown[]
): void {

  for (
    const item
    of rows.slice(
      0,
      30
    )
  ) {
    const row =
      asRecord(
        item
      );

    if (!row) {
      continue;
    }

    console.log({
      position:
        row.position ??
        null,

      team:
        teamName(
          row.team
        ),

      points:
        row.points ??
        null,

      matches:
        row.matches ??
        null,

      wins:
        row.wins ??
        null,

      draws:
        row.draws ??
        null,

      losses:
        row.losses ??
        null,

      scoresFor:
        row.scoresFor ??
        null,

      scoresAgainst:
        row.scoresAgainst ??
        null,
    });
  }
}

let standingsCount =
  0;

function walk(
  value:
    unknown,

  path:
    string,

  parents:
    JsonRecord[] =
    [],

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
    const standingRows =
      value.filter(
        looksLikeStandingRow
      );

    if (
      standingRows.length >=
      2
    ) {
      standingsCount +=
        1;

      console.log(
        "\n========================================"
      );

      console.log(
        `STANDINGS #${standingsCount}`
      );

      console.log(
        "PATH:",
        path
      );

      console.log(
        "ROWS:",
        value.length
      );

      const nearest =
        parents
          .slice(
            -5
          )
          .reverse();

      console.log(
        "\nANCESTORS:"
      );

      nearest.forEach(
        (
          parent,
          index
        ) => {

          console.log(
            `-- ancestor ${index + 1} --`
          );

          console.dir(
            summarizeRecord(
              parent
            ),
            {
              depth:
                5,
            }
          );
        }
      );

      console.log(
        "\nTEAMS:"
      );

      printRows(
        value
      );
    }

    value.forEach(
      (
        child,
        index
      ) => {

        walk(
          child,
          `${path}[${index}]`,
          parents,
          depth +
            1
        );
      }
    );

    return;
  }

  const record =
    asRecord(
      value
    );

  if (!record) {
    return;
  }

  /*
   * Queremos localizar cualquier objeto
   * relacionado directamente con el grupo
   * del partido.
   */
  const serialized =
    JSON.stringify(
      record
    );

  if (
    serialized.includes(
      '"194069"'
    ) ||
    serialized.includes(
      ":194069"
    )
  ) {
    console.log(
      "\n***************************************"
    );

    console.log(
      "OBJECT CONTAINS tournamentId 194069"
    );

    console.log(
      "PATH:",
      path
    );

    console.dir(
      summarizeRecord(
        record
      ),
      {
        depth:
          5,
      }
    );
  }

  const nextParents =
    [
      ...parents.slice(
        -7
      ),
      record,
    ];

  for (
    const [
      key,
      child,
    ]
    of Object.entries(
      record
    )
  ) {
    walk(
      child,
      `${path}.${key}`,
      nextParents,
      depth +
        1
    );
  }
}

async function main():
  Promise<void> {

  const url =
    process.argv[2] ??
    "https://www.sofascore.com/football/tournament/china/cmcl-champions-league/35616#id:96779";

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
      1500
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

    await fs.writeFile(
      "/tmp/sofascore-cmcl-next-data.json",
      JSON.stringify(
        payload,
        null,
        2
      ),
      "utf8"
    );

    walk(
      payload,
      "$"
    );

    console.log(
      "\n================================"
    );

    console.log(
      "TOTAL STANDINGS ARRAYS:",
      standingsCount
    );

    console.log(
      "================================"
    );

    console.log(
      "SAVED:"
    );

    console.log(
      "/tmp/sofascore-cmcl-next-data.json"
    );
  } finally {
    await browser.stop();
  }
}

void main();
