import os from "node:os";
import path from "node:path";

import {
  chromium,
  type BrowserContext,
  type Page,
} from "playwright";

type JsonRecord =
  Record<string, unknown>;

interface LiveMatch {
  id: string | null;
  url: string;
  text: string;
  context: string;
}

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

function extractEventId(
  url: string
): string | null {
  return (
    url.match(
      /#id:(\d+)/
    )?.[1] ??
    null
  );
}

async function collectVisible(
  page: Page,
  matches:
    Map<
      string,
      LiveMatch
    >
): Promise<void> {

  const links =
    page.locator(
      'a[href*="/football/match/"]:visible'
    );

  const count =
    await links.count();

  for (
    let index = 0;
    index < count;
    index += 1
  ) {
    const link =
      links.nth(index);

    if (
      !await link
        .isVisible()
        .catch(
          () => false
        )
    ) {
      continue;
    }

    const href =
      await link
        .getAttribute(
          "href"
        );

    if (!href) {
      continue;
    }

    const url =
      href.startsWith(
        "http"
      )
        ? href
        : `https://www.sofascore.com${href}`;

    const text =
      (
        await link
          .innerText()
          .catch(
            () => ""
          )
      )
        .replace(
          /\s+/g,
          " "
        )
        .trim();

    const context =
      await link
        .evaluate(
          element => {
            let current:
              HTMLElement | null =
              element as HTMLElement;

            let best =
              "";

            for (
              let depth = 0;
              depth < 5 &&
              current;
              depth += 1
            ) {
              const value =
                (
                  current.innerText ??
                  ""
                )
                  .replace(
                    /\s+/g,
                    " "
                  )
                  .trim();

              if (
                value.length >
                  best.length &&
                value.length <
                  600
              ) {
                best =
                  value;
              }

              current =
                current
                  .parentElement;
            }

            return best;
          }
        )
        .catch(
          () => ""
        );

    /*
     * Estamos dentro del filtro En Vivo.
     * Aun así exigimos alguna señal visual
     * de que el elemento corresponde a live.
     */
    const combined =
      `${text} ${context}`
        .toLowerCase();

    if (
      !combined.includes(
        "en vivo"
      ) &&
      !combined.includes(
        "live"
      )
    ) {
      continue;
    }

    matches.set(
      url,
      {
        id:
          extractEventId(
            url
          ),

        url,
        text,
        context,
      }
    );
  }
}

async function inspectMatch(
  context:
    BrowserContext,

  match:
    LiveMatch
): Promise<void> {

  const page =
    await context.newPage();

  try {
    const incidentsPromise =
      page.waitForResponse(
        response =>
          /\/api\/v1\/event\/\d+\/incidents(?:\?|$)/
            .test(
              response.url()
            ),
        {
          timeout:
            20_000,
        }
      )
        .catch(
          () => null
        );

    await page.goto(
      match.url,
      {
        waitUntil:
          "domcontentloaded",

        timeout:
          30_000,
      }
    );

    const response =
      await incidentsPromise;

    console.log(
      "\n================================"
    );

    console.log(
      "EVENT ID:",
      match.id
    );

    console.log(
      "MATCH:",
      match.context ||
      match.text
    );

    console.log(
      "URL:",
      match.url
    );

    if (!response) {
      console.log(
        "INCIDENTS: NO RESPONSE"
      );

      return;
    }

    console.log(
      "INCIDENT HTTP:",
      response.status()
    );

    if (
      !response.ok()
    ) {
      return;
    }

    const payload:
      unknown =
      await response.json();

    const root =
      asRecord(
        payload
      );

    const incidents =
      Array.isArray(
        root?.incidents
      )
        ? root.incidents
        : [];

    const cards =
      incidents
        .map(
          asRecord
        )
        .filter(
          (
            value
          ): value is
            JsonRecord =>
              value !==
              null
        )
        .filter(
          incident =>
            incident.incidentType ===
            "card"
        );

    /*
     * Sofascore puede usar por ejemplo:
     *
     * yellow
     * red
     * yellowRed
     *
     * Por eso buscamos "red" y no
     * solamente igualdad exacta.
     */
    const redCards =
      cards.filter(
        incident =>
          String(
            incident.incidentClass ??
            ""
          )
            .toLowerCase()
            .includes(
              "red"
            )
      );

    console.log(
      "TOTAL INCIDENTS:",
      incidents.length
    );

    console.log(
      "CARDS:",
      cards.length
    );

    console.log(
      "RED CARDS:",
      redCards.length
    );

    if (
      cards.length >
      0
    ) {
      console.log(
        "\nALL CARDS:"
      );

      console.dir(
        cards.map(
          card => ({
            time:
              card.time ??
              null,

            addedTime:
              card.addedTime ??
              null,

            isHome:
              card.isHome ??
              null,

            incidentClass:
              card.incidentClass ??
              null,

            player:
              asRecord(
                card.player
              )?.name ??
              null,

            id:
              card.id ??
              null,
          })
        ),
        {
          depth:
            null,
        }
      );
    }

    if (
      redCards.length >
      0
    ) {
      console.log(
        "\n🚨🚨🚨 RED CARD FOUND 🚨🚨🚨"
      );

      console.dir(
        redCards.map(
          card => ({
            eventId:
              match.id,

            match:
              match.context ||
              match.text,

            time:
              card.time ??
              null,

            addedTime:
              card.addedTime ??
              null,

            isHome:
              card.isHome ??
              null,

            incidentClass:
              card.incidentClass ??
              null,

            player:
              asRecord(
                card.player
              )?.name ??
              null,

            cardId:
              card.id ??
              null,
          })
        ),
        {
          depth:
            null,
        }
      );
    }
  } finally {
    await page
      .close()
      .catch(
        () => undefined
      );
  }
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
      "HOME:",
      page.url()
    );

    const liveButton =
      page
        .getByRole(
          "button",
          {
            name:
              /^En Vivo(?:\s*\(\d+\))?$/i,
          }
        )
        .first();

    if (
      await liveButton.count() ===
      0
    ) {
      throw new Error(
        "Live button not found"
      );
    }

    console.log(
      "LIVE BUTTON:",
      (
        await liveButton
          .innerText()
      )
        .replace(
          /\s+/g,
          " "
        )
        .trim()
    );

    await liveButton.click();

    await page.waitForTimeout(
      1500
    );

    await page.evaluate(
      () =>
        window.scrollTo(
          0,
          0
        )
    );

    const matches =
      new Map<
        string,
        LiveMatch
      >();

    let scansWithoutNew =
      0;

    /*
     * Recorremos toda la lista virtualizada.
     */
    for (
      let scan = 0;
      scan < 45;
      scan += 1
    ) {
      const before =
        matches.size;

      await collectVisible(
        page,
        matches
      );

      console.log(
        `SCAN ${scan + 1}: matches=${matches.size}`
      );

      if (
        matches.size ===
        before
      ) {
        scansWithoutNew +=
          1;
      } else {
        scansWithoutNew =
          0;
      }

      if (
        scansWithoutNew >=
        7
      ) {
        break;
      }

      await page.mouse.wheel(
        0,
        850
      );

      await page.waitForTimeout(
        350
      );
    }

    console.log(
      "\n================================"
    );

    console.log(
      "ALL LIVE MATCHES:",
      matches.size
    );

    console.log(
      "================================"
    );

    let number =
      0;

    for (
      const match
      of matches.values()
    ) {
      number += 1;

      console.log(
        `\n[${number}/${matches.size}]`
      );

      await inspectMatch(
        context,
        match
      );
    }
  } finally {
    await context.close();
  }
}

void main();
