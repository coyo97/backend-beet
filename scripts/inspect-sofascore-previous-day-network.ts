import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  chromium,
} from "playwright";

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
    await chromium.launchPersistentContext(
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

  const seen =
    new Set<string>();

  let saved =
    0;

  page.on(
    "response",
    async response => {
      const request =
        response.request();

      const type =
        request.resourceType();

      if (
        type !== "xhr" &&
        type !== "fetch"
      ) {
        return;
      }

      const url =
        response.url();

      if (
        !url.includes(
          "sofascore.com/api/v1"
        )
      ) {
        return;
      }

      if (
        seen.has(url)
      ) {
        return;
      }

      seen.add(url);

      /*
       * Nos interesan especialmente
       * endpoints relacionados con eventos,
       * fútbol y fechas.
       */
      if (
        !/football|event|schedule|date|calendar/i
          .test(url)
      ) {
        return;
      }

      console.log(
        "\n================================"
      );

      console.log(
        "HTTP:",
        response.status()
      );

      console.log(
        "TYPE:",
        type
      );

      console.log(
        "URL:",
        url
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
        !contentType.includes(
          "json"
        )
      ) {
        return;
      }

      try {
        const body =
          await response.text();

        console.log(
          "BODY PREVIEW:",
          body.slice(
            0,
            1200
          )
        );

        saved += 1;

        fs.writeFileSync(
          `/tmp/sofascore-prev-${String(
            saved
          ).padStart(
            3,
            "0"
          )}.json`,
          body,
          "utf8"
        );

        console.log(
          "SAVED:",
          `/tmp/sofascore-prev-${String(
            saved
          ).padStart(
            3,
            "0"
          )}.json`
        );
      } catch (
        error
      ) {
        console.log(
          "BODY ERROR:",
          String(error)
        );
      }
    }
  );

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
      "PAGE:",
      page.url()
    );

    /*
     * Hay otro botón "Anterior" arriba
     * cuyo texto está vacío y usa aria-label.
     *
     * El selector hasText /^Anterior$/
     * apunta al navegador de fecha que
     * vimos en tu página.
     */
    const previousButtons =
      page
        .locator(
          "button:visible"
        )
        .filter({
          hasText:
            /^Anterior$/i,
        });

    const count =
      await previousButtons.count();

    console.log(
      "PREVIOUS BUTTONS:",
      count
    );

    for (
      let index = 0;
      index < count;
      index += 1
    ) {
      const button =
        previousButtons.nth(
          index
        );

      console.log(
        `\n--- PREVIOUS ${index} ---`
      );

      console.dir(
        await button.evaluate(
          element => {
            const node =
              element as HTMLElement;

            let parent:
              HTMLElement | null =
              node;

            let context =
              "";

            for (
              let depth = 0;
              depth < 5 &&
              parent;
              depth += 1
            ) {
              const candidate =
                (
                  parent.innerText ??
                  ""
                )
                  .replace(
                    /\s+/g,
                    " "
                  )
                  .trim();

              if (
                candidate.length >
                  context.length &&
                candidate.length <
                  800
              ) {
                context =
                  candidate;
              }

              parent =
                parent.parentElement;
            }

            return {
              text:
                (
                  node.innerText ??
                  ""
                )
                  .replace(
                    /\s+/g,
                    " "
                  )
                  .trim(),

              ariaLabel:
                node.getAttribute(
                  "aria-label"
                ),

              context,
            };
          }
        ),
        {
          depth:
            null,
        }
      );
    }

    if (
      count === 0
    ) {
      throw new Error(
        "Previous date button not found"
      );
    }

    /*
     * En nuestra inspección anterior
     * este es el botón textual del
     * navegador de fechas.
     */
    const previous =
      previousButtons.last();

    console.log(
      "\nCLICKING PREVIOUS DATE..."
    );

    await previous.click({
      timeout:
        10_000,
    });

    /*
     * Esperamos las llamadas que genera
     * el cambio de fecha.
     */
    await page.waitForTimeout(
      7000
    );

    console.log(
      "\nFINAL URL:",
      page.url()
    );

    console.log(
      "CAPTURED:",
      saved
    );

    console.log(
      "\n===== CURRENT MATCH LINKS ====="
    );

    const matches =
      await page
        .locator(
          'a[href*="/football/match/"]:visible'
        )
        .evaluateAll(
          elements =>
            elements
              .slice(
                0,
                30
              )
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
        );

    console.dir(
      matches,
      {
        depth:
          null,
      }
    );
  } finally {
    await context.close();
  }
}

void main();
