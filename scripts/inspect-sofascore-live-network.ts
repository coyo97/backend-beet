import fs from "node:fs";

import {
  SofascoreBrowser,
} from "../src/modules/football/infrastructure/providers/sofascore-browser/SofascoreBrowser";

type JsonRecord =
  Record<
    string,
    unknown
  >;

interface EventArrayCandidate {
  path:
    string;

  events:
    JsonRecord[];
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

function isEventLike(
  value:
    unknown
): value is JsonRecord {

  const item =
    asRecord(
      value
    );

  if (!item) {
    return false;
  }

  const homeTeam =
    asRecord(
      item.homeTeam
    );

  const awayTeam =
    asRecord(
      item.awayTeam
    );

  return Boolean(
    item.id &&
    homeTeam &&
    awayTeam
  );
}

function findEventArrays(
  value:
    unknown,

  path =
    "root",

  depth =
    0
): EventArrayCandidate[] {

  if (
    depth >
    7
  ) {
    return [];
  }

  const result:
    EventArrayCandidate[] =
    [];

  if (
    Array.isArray(
      value
    )
  ) {
    const events =
      value.filter(
        isEventLike
      );

    if (
      events.length >
      0
    ) {
      result.push({
        path,
        events,
      });
    }

    /*
     * No hace falta recorrer miles
     * de elementos completos.
     */
    for (
      const [
        index,
        item,
      ]
      of value
        .slice(
          0,
          5
        )
        .entries()
    ) {
      result.push(
        ...findEventArrays(
          item,
          `${path}[${index}]`,
          depth +
            1
        )
      );
    }

    return result;
  }

  const record =
    asRecord(
      value
    );

  if (!record) {
    return result;
  }

  for (
    const [
      key,
      item,
    ]
    of Object.entries(
      record
    )
  ) {
    result.push(
      ...findEventArrays(
        item,
        `${path}.${key}`,
        depth +
          1
      )
    );
  }

  return result;
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
  event:
    JsonRecord
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
      stringValue(
        home?.name
      ),

    away:
      stringValue(
        away?.name
      ),

    homeScore:
      numberValue(
        homeScore?.current
      ),

    awayScore:
      numberValue(
        awayScore?.current
      ),

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
        uniqueTournament
          ?.name
      ),

    startTimestamp:
      event.startTimestamp ??
      null,
  };
}

async function main():
  Promise<void> {

  const browser =
    new SofascoreBrowser();

  const page =
    await browser
      .getPage();

  let candidateNumber =
    0;

  const seenUrls =
    new Set<
      string
    >();

  page.on(
    "response",
    async (
      response
    ) => {

      const url =
        response.url();

      if (
        seenUrls.has(
          url
        )
      ) {
        return;
      }

      const contentType =
        response.headers()[
          "content-type"
        ] ??
        "";

      if (
        !contentType.includes(
          "application/json"
        )
      ) {
        return;
      }

      if (
        !url.includes(
          "sofascore"
        )
      ) {
        return;
      }

      let payload:
        unknown;

      try {
        payload =
          await response.json();
      } catch {
        return;
      }

      const candidates =
        findEventArrays(
          payload
        );

      if (
        candidates.length ===
        0
      ) {
        return;
      }

      seenUrls.add(
        url
      );

      candidateNumber +=
        1;

      console.log(
        "\n========================================"
      );

      console.log(
        `CANDIDATE ${candidateNumber}`
      );

      console.log(
        "HTTP:",
        response.status()
      );

      console.log(
        "URL:",
        url
      );

      for (
        const candidate
        of candidates
      ) {
        console.log(
          "\nPATH:",
          candidate.path
        );

        console.log(
          "EVENTS:",
          candidate.events.length
        );

        console.dir(
          candidate.events
            .slice(
              0,
              5
            )
            .map(
              describeEvent
            ),
          {
            depth:
              null,
          }
        );
      }

      if (
        candidateNumber <=
        10
      ) {
        const filename =
          `/tmp/sofascore-candidate-${candidateNumber}.json`;

        try {
          fs.writeFileSync(
            filename,
            JSON.stringify(
              payload,
              null,
              2
            ),
            "utf8"
          );

          console.log(
            "SAVED:",
            filename
          );
        } catch (
          error
        ) {
          console.warn(
            "Could not save candidate",
            error
          );
        }
      }
    }
  );

  try {
    /*
     * El listener ya está activo
     * ANTES de abrir Sofascore.
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
      2_000
    );

    const liveButton =
      page.getByRole(
        "button",
        {
          name:
            /^(En vivo|En Vivo|Live)(?:\s*\(\d+\))?$/i,
        }
      );

    const count =
      await liveButton
        .count();

    console.log(
      "\nLIVE BUTTONS:",
      count
    );

    if (
      count >
      0
    ) {
      const button =
        liveButton.first();

      console.log(
        "CLICKING LIVE..."
      );

      await button.click({
        timeout:
          10_000,
      });

      await page.waitForTimeout(
        6_000
      );

      console.log(
        "\nLIVE BUTTON ATTRIBUTES:"
      );

      console.dir(
        await button.evaluate(
          (
            element
          ) => ({
            class:
              element.getAttribute(
                "class"
              ),

            ariaPressed:
              element.getAttribute(
                "aria-pressed"
              ),

            ariaSelected:
              element.getAttribute(
                "aria-selected"
              ),

            dataState:
              element.getAttribute(
                "data-state"
              ),
          })
        )
      );
    }

    /*
     * Dejamos unos segundos adicionales
     * porque algunos datos pueden llegar
     * después de seleccionar En vivo.
     */
    await page.waitForTimeout(
      4_000
    );

    console.log(
      "\n========================================"
    );

    console.log(
      "TOTAL JSON CANDIDATES:",
      candidateNumber
    );

    console.log(
      "========================================"
    );
  } finally {
    await browser.stop();
  }
}

void main();
