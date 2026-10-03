import fs from "node:fs";

import {
  SofascoreBrowser,
} from "../src/modules/football/infrastructure/providers/sofascore-browser/SofascoreBrowser";

const URL =
  "https://www.sofascore.com/es/football/tournament/russia-amateur/championship-sff-sibir/20768#id:90865";

const NEEDLES =
  [
    "Raspadskaya",
    "Buryatia",
    "Sibir-M",
    "KDV-2",
    "Temp Barnaul",
    "standings",
    "Clasificaciones",
    "points",
    "position",
    "90865",
    "20768",
  ];

function printOccurrences(
  source:
    string,

  needle:
    string
): void {

  const lower =
    source.toLowerCase();

  const target =
    needle.toLowerCase();

  let cursor =
    0;

  let count =
    0;

  while (true) {
    const index =
      lower.indexOf(
        target,
        cursor
      );

    if (
      index ===
      -1
    ) {
      break;
    }

    count +=
      1;

    console.log(
      `\n--- ${needle} #${count} @ ${index} ---`
    );

    console.log(
      source.slice(
        Math.max(
          0,
          index -
            800
        ),
        Math.min(
          source.length,
          index +
            1800
        )
      )
    );

    cursor =
      index +
      target.length;

    if (
      count >=
      5
    ) {
      break;
    }
  }

  if (
    count ===
    0
  ) {
    console.log(
      `${needle}: NOT FOUND`
    );
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

    await page.goto(
      URL,
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

    /*
     * Esta vez buscamos específicamente
     * el botón, no cualquier texto que
     * diga "Clasificaciones".
     */
    const standingsButton =
      page
        .locator(
          "button:visible"
        )
        .filter({
          hasText:
            /^Clasificaciones$/i,
        });

    console.log(
      "STANDINGS BUTTONS:",
      await standingsButton.count()
    );

    if (
      await standingsButton.count() >
      0
    ) {
      const button =
        standingsButton.first();

      await button.scrollIntoViewIfNeeded();

      console.log(
        "\nBUTTON HTML:"
      );

      console.log(
        await button.evaluate(
          (
            element
          ) =>
            element.outerHTML
        )
      );

      try {
        await button.click();

        await page.waitForTimeout(
          1500
        );
      } catch (
        error
      ) {
        console.log(
          "CLICK ERROR:",
          error
        );
      }
    }

    /*
     * Bajamos también hacia el contenido
     * del torneo por si la clasificación
     * usa lazy rendering.
     */
    const standingsHeading =
      page.getByText(
        /^Clasificaciones$/i
      )
        .last();

    if (
      await standingsHeading.count() >
      0
    ) {
      await standingsHeading
        .scrollIntoViewIfNeeded()
        .catch(
          () => undefined
        );

      await page.waitForTimeout(
        1000
      );
    }

    const html =
      await page.content();

    fs.writeFileSync(
      "/tmp/sofascore-sibir.html",
      html,
      "utf8"
    );

    console.log(
      "\nHTML SAVED:",
      "/tmp/sofascore-sibir.html"
    );

    console.log(
      "\n===== HTML SEARCH ====="
    );

    for (
      const needle
      of NEEDLES
    ) {
      printOccurrences(
        html,
        needle
      );
    }

    console.log(
      "\n===== SCRIPT INSPECTION ====="
    );

    const scripts =
      await page
        .locator(
          "script"
        )
        .evaluateAll(
          (
            elements
          ) =>
            elements.map(
              (
                element,
                index
              ) => ({
                index,

                type:
                  element.getAttribute(
                    "type"
                  ),

                id:
                  element.getAttribute(
                    "id"
                  ),

                length:
                  (
                    element.textContent ??
                    ""
                  ).length,

                text:
                  element.textContent ??
                  "",
              })
            )
        );

    for (
      const script
      of scripts
    ) {
      const lower =
        script.text
          .toLowerCase();

      const interesting =
        NEEDLES.some(
          (
            needle
          ) =>
            lower.includes(
              needle
                .toLowerCase()
            )
        );

      if (
        !interesting
      ) {
        continue;
      }

      console.log(
        "\nSCRIPT:",
        {
          index:
            script.index,

          id:
            script.id,

          type:
            script.type,

          length:
            script.length,
        }
      );

      for (
        const needle
        of NEEDLES
      ) {
        const index =
          lower.indexOf(
            needle
              .toLowerCase()
          );

        if (
          index ===
          -1
        ) {
          continue;
        }

        console.log(
          `\n${needle}:`
        );

        console.log(
          script.text.slice(
            Math.max(
              0,
              index -
                600
            ),
            Math.min(
              script.text.length,
              index +
                1600
            )
          )
        );
      }
    }

    /*
     * Además comprobamos si los equipos
     * existen en el DOM pero están ocultos.
     */
    console.log(
      "\n===== TEAM DOM ====="
    );

    const teams =
      [
        "Raspadskaya",
        "Buryatia",
        "Sibir-M",
        "KDV-2",
        "Temp Barnaul",
      ];

    for (
      const team
      of teams
    ) {
      const locator =
        page.getByText(
          new RegExp(
            team,
            "i"
          )
        );

      const count =
        await locator.count();

      console.log(
        `\n${team}:`,
        count
      );

      for (
        let index =
          0;

        index <
          Math.min(
            count,
            5
          );

        index +=
          1
      ) {
        const item =
          locator.nth(
            index
          );

        console.dir(
          {
            visible:
              await item
                .isVisible()
                .catch(
                  () =>
                    false
                ),

            text:
              await item
                .innerText()
                .catch(
                  () =>
                    ""
                ),

            html:
              await item
                .evaluate(
                  (
                    element
                  ) =>
                    element.outerHTML
                )
                .catch(
                  () =>
                    ""
                ),
          },
          {
            depth:
              null,
          }
        );
      }
    }
  } finally {
    await browser.stop();
  }
}

void main();
