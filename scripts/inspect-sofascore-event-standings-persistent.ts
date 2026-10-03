import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  chromium,
} from "playwright";

async function main(): Promise<void> {
  const url =
    process.argv[2];

  if (!url) {
    console.error(
      'Usage: npx tsx scripts/inspect-sofascore-event-standings-persistent.ts "URL"'
    );

    process.exitCode = 1;
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
    await chromium.launchPersistentContext(
      profileDir,
      {
        headless: false,

        locale:
          "es-ES",

        timezoneId:
          "America/La_Paz",

        viewport: {
          width: 1365,
          height: 900,
        },
      }
    );

  const page =
    context.pages()[0] ??
    await context.newPage();

  const seen =
    new Set<string>();

  page.on(
    "response",
    async response => {
      const request =
        response.request();

      const resourceType =
        request.resourceType();

      if (
        resourceType !== "xhr" &&
        resourceType !== "fetch"
      ) {
        return;
      }

      const responseUrl =
        response.url();

      if (
        seen.has(responseUrl)
      ) {
        return;
      }

      seen.add(responseUrl);

      const interesting =
        /standing|tournament|season|event|table/i
          .test(responseUrl);

      if (!interesting) {
        return;
      }

      console.log(
        "\n[RESPONSE]"
      );

      console.log(
        response.status(),
        resourceType.toUpperCase(),
        responseUrl
      );

      const contentType =
        response.headers()[
          "content-type"
        ] ?? "";

      console.log(
        "CONTENT-TYPE:",
        contentType
      );

      if (
        contentType.includes(
          "json"
        ) ||
        contentType.includes(
          "text"
        )
      ) {
        try {
          const body =
            await response.text();

          console.log(
            "BODY:",
            body.slice(
              0,
              2500
            )
          );
        } catch {
          //
        }
      }
    }
  );

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
      2500
    );

    console.log(
      "TITLE:",
      await page.title()
    );

    console.log(
      "URL:",
      page.url()
    );

    console.log(
      "\n===== STANDINGS TEXT CANDIDATES ====="
    );

    const candidates =
      page.getByText(
        /Clasificaciones|Clasificación|Standings|Tabla/i
      );

    const count =
      await candidates.count();

    console.log(
      "COUNT:",
      count
    );

    for (
      let index = 0;
      index < Math.min(
        count,
        30
      );
      index += 1
    ) {
      const element =
        candidates.nth(index);

      console.log(
        `\n--- CANDIDATE ${index} ---`
      );

      console.dir(
        await element
          .evaluate(
            node => {
              const element =
                node as HTMLElement;

              return {
                tag:
                  element.tagName,

                text:
                  (
                    element.innerText ??
                    element.textContent ??
                    ""
                  )
                    .replace(
                      /\s+/g,
                      " "
                    )
                    .trim(),

                role:
                  element.getAttribute(
                    "role"
                  ),

                class:
                  element.getAttribute(
                    "class"
                  ),

                ariaSelected:
                  element.getAttribute(
                    "aria-selected"
                  ),
              };
            }
          )
          .catch(
            () => null
          ),
        {
          depth: null,
        }
      );
    }

    /*
     * Intentamos encontrar algo clicable
     * relacionado con Clasificaciones.
     */
    const clickable =
      page
        .locator(
          'button:visible, [role="tab"]:visible, [role="button"]:visible'
        )
        .filter({
          hasText:
            /Clasificaciones|Clasificación|Standings|Tabla/i,
        });

    console.log(
      "\nCLICKABLE:",
      await clickable.count()
    );

    if (
      await clickable.count() >
      0
    ) {
      const target =
        clickable.first();

      await target
        .scrollIntoViewIfNeeded()
        .catch(
          () => undefined
        );

      console.log(
        "CLICKING:",
        (
          await target
            .innerText()
            .catch(
              () => ""
            )
        )
          .replace(
            /\s+/g,
            " "
          )
          .trim()
      );

      await target
        .click({
          timeout:
            10_000,
        })
        .catch(
          error => {
            console.log(
              "CLICK ERROR:",
              String(error)
            );
          }
        );

      await page.waitForTimeout(
        5000
      );
    }

    /*
     * También desplazamos toda la página
     * para forzar lazy rendering.
     */
    for (
      let index = 0;
      index < 12;
      index += 1
    ) {
      await page.mouse.wheel(
        0,
        800
      );

      await page.waitForTimeout(
        250
      );
    }

    await page.waitForTimeout(
      2500
    );

    const bodyText =
      await page
        .locator("body")
        .innerText();

    fs.writeFileSync(
      "/tmp/sofascore-event-body.txt",
      bodyText,
      "utf8"
    );

    const html =
      await page.content();

    fs.writeFileSync(
      "/tmp/sofascore-event-after-standings.html",
      html,
      "utf8"
    );

    console.log(
      "\n===== TEXT AROUND CLASIFICACIONES ====="
    );

    const lower =
      bodyText.toLowerCase();

    for (
      const needle
      of [
        "clasificaciones",
        "clasificación",
        "standings",
      ]
    ) {
      const index =
        lower.indexOf(
          needle.toLowerCase()
        );

      if (
        index === -1
      ) {
        continue;
      }

      console.log(
        bodyText.slice(
          Math.max(
            0,
            index - 1500
          ),
          Math.min(
            bodyText.length,
            index + 6000
          )
        )
      );

      break;
    }

    console.log(
      "\n===== TEAM NAMES / NUMERIC ROWS ====="
    );

    const lines =
      bodyText
        .split("\n")
        .map(
          line =>
            line.trim()
        )
        .filter(Boolean);

    lines
      .filter(
        line =>
          /Yokogawa|Numazu|pts|puntos|PJ|PG|PE|PP/i
            .test(line)
      )
      .slice(
        0,
        150
      )
      .forEach(
        line =>
          console.log(line)
      );

    console.log(
      "\nSAVED:"
    );

    console.log(
      "/tmp/sofascore-event-body.txt"
    );

    console.log(
      "/tmp/sofascore-event-after-standings.html"
    );
  } finally {
    await context.close();
  }
}

void main();
