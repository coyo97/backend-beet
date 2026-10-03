import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { chromium } from "playwright";

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

function textValue(
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
  output: Map<string, JsonRecord>,
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
      textValue(
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

function collectInteresting(
  value: unknown,
  path = "event",
  depth = 0,
  output:
    Record<
      string,
      unknown
    > = {}
): Record<string, unknown> {
  if (
    depth > 7 ||
    value === null ||
    value === undefined
  ) {
    return output;
  }

  if (
    Array.isArray(value)
  ) {
    value
      .slice(0, 30)
      .forEach(
        (
          item,
          index
        ) =>
          collectInteresting(
            item,
            `${path}[${index}]`,
            depth + 1,
            output
          )
      );

    return output;
  }

  const record =
    asRecord(value);

  if (!record) {
    return output;
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
      /red|card|incident|yellow|minute|period|status|standing|position|points/i
        .test(key)
    ) {
      output[
        childPath
      ] =
        child;
    }

    collectInteresting(
      child,
      childPath,
      depth + 1,
      output
    );
  }

  return output;
}

function describe(
  event: JsonRecord
) {
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

  const season =
    asRecord(
      event.season
    );

  return {
    id:
      event.id ?? null,

    home:
      home?.name ?? null,

    away:
      away?.name ?? null,

    score: [
      homeScore?.current ??
        null,

      awayScore?.current ??
        null,
    ],

    status:
      status?.type ??
      status?.description ??
      null,

    tournamentId:
      tournament?.id ??
      null,

    tournament:
      tournament?.name ??
      null,

    seasonId:
      season?.id ??
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

  const profile =
    path.join(
      os.homedir(),
      ".cache",
      "football-radar",
      "sofascore-profile"
    );

  const context =
    await chromium
      .launchPersistentContext(
        profile,
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
      1500
    );

    console.log(
      "URL:",
      page.url()
    );

    const live =
      page
        .getByRole(
          "button",
          {
            name:
              /^En Vivo(?:\s*\(\d+\))?$/i,
          }
        )
        .first();

    console.log(
      "LIVE BUTTONS:",
      await live.count()
    );

    if (
      await live.count()
    ) {
      await live.click();

      await page.waitForTimeout(
        1500
      );
    }

    console.log(
      "\n===== LIVE LINKS ====="
    );

    const links =
      await page
        .locator(
          'a[href*="/football/match/"]:visible'
        )
        .evaluateAll(
          elements =>
            elements
              .map(
                element => ({
                  href:
                    element.getAttribute(
                      "href"
                    ),

                  text:
                    (
                      (
                        element as HTMLElement
                      ).innerText ??
                      ""
                    )
                      .replace(
                        /\s+/g,
                        " "
                      )
                      .trim(),
                })
              )
              .filter(
                item =>
                  item.text
                    .toLowerCase()
                    .includes(
                      "en vivo"
                    )
              )
        );

    console.dir(
      links,
      {
        depth:
          null,
      }
    );

    const nextData =
      page.locator(
        "script#__NEXT_DATA__"
      );

    console.log(
      "\nNEXT_DATA:",
      await nextData.count()
    );

    const raw =
      await nextData
        .textContent();

    if (!raw) {
      throw new Error(
        "No __NEXT_DATA__"
      );
    }

    fs.writeFileSync(
      "/tmp/sofascore-persistent-next-data.json",
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
      "\nEVENT OBJECTS:",
      events.size
    );

    for (
      const event
      of events.values()
    ) {
      const status =
        asRecord(
          event.status
        );

      const type =
        textValue(
          status?.type
        )
          ?.toLowerCase();

      if (
        type !== "inprogress" &&
        type !== "live" &&
        type !== "halftime" &&
        type !== "paused"
      ) {
        continue;
      }

      console.log(
        "\n================================"
      );

      console.dir(
        describe(event),
        {
          depth:
            null,
        }
      );

      const interesting =
        collectInteresting(
          event
        );

      console.log(
        "INTERESTING:"
      );

      console.dir(
        interesting,
        {
          depth:
            5,
        }
      );
    }

    console.log(
      "\nSAVED:",
      "/tmp/sofascore-persistent-next-data.json"
    );
  } finally {
    await context.close();
  }
}

void main();
