import fs from "node:fs/promises";

import type {
  Locator,
  Page,
} from "playwright";

import {
  SofascoreBrowser,
} from "../src/modules/football/infrastructure/providers/sofascore-browser/SofascoreBrowser";

async function findMatchesControl(
  page:
    Page
): Promise<
  Locator | null
> {

  const patterns =
    /Partidos|Matches|Resultados|Results/i;

  const candidates = [
    page.getByRole(
      "tab",
      {
        name:
          patterns,
      }
    ),

    page.getByRole(
      "button",
      {
        name:
          patterns,
      }
    ),

    page.getByRole(
      "link",
      {
        name:
          patterns,
      }
    ),

    page.getByText(
      patterns
    ),
  ];

  for (
    const candidate
    of candidates
  ) {
    const count =
      await candidate.count();

    for (
      let index =
        0;

      index <
        count;

      index +=
        1
    ) {
      const item =
        candidate.nth(
          index
        );

      if (
        await item
          .isVisible()
          .catch(
            () =>
              false
          )
      ) {
        return item;
      }
    }
  }

  return null;
}

async function main():
  Promise<void> {

  const url =
    process.argv[2] ??
    "https://www.sofascore.com/football/team/wuhan-lianzhen-fc/1079261";

  const browser =
    new SofascoreBrowser();

  try {
    const page =
      await browser
        .getPage();

    const relevantResponses:
      {
        status:
          number;

        url:
          string;

        contentType:
          string;

        body:
          string | null;
      }[] =
      [];

    page.on(
      "response",
      async (
        response
      ) => {

        const request =
          response.request();

        const resourceType =
          request
            .resourceType();

        if (
          resourceType !==
            "fetch" &&
          resourceType !==
            "xhr"
        ) {
          return;
        }

        const responseUrl =
          response.url();

        /*
         * Ignoramos publicidad,
         * analytics y Cloudflare.
         */
        if (
          /google|fundingchoices|hbwrapper|doubleclick|cloudflare|challenges/i
            .test(
              responseUrl
            )
        ) {
          return;
        }

        const contentType =
          response
            .headers()[
              "content-type"
            ] ??
          "";

        let body:
          string | null =
          null;

        if (
          contentType.includes(
            "json"
          ) ||
          contentType.includes(
            "text"
          )
        ) {
          body =
            await response
              .text()
              .catch(
                () =>
                  null
              );
        }

        relevantResponses.push({
          status:
            response.status(),

          url:
            responseUrl,

          contentType,

          body,
        });

        console.log(
          "\n[RESPONSE]"
        );

        console.log(
          response.status(),
          resourceType.toUpperCase()
        );

        console.log(
          responseUrl
        );

        if (body) {
          console.log(
            body.slice(
              0,
              1200
            )
          );
        }
      }
    );

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
      1800
    );

    console.log(
      "\nTITLE:"
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

    /*
     * Imprimimos tabs/buttons/links visibles
     * para conocer la UI real actual.
     */
    console.log(
      "\n===== VISIBLE NAVIGATION ====="
    );

    for (
      const selector
      of [
        '[role="tab"]:visible',
        'button:visible',
        'a:visible',
      ]
    ) {
      const items =
        page.locator(
          selector
        );

      const count =
        Math.min(
          await items.count(),
          80
        );

      for (
        let index =
          0;

        index <
          count;

        index +=
          1
      ) {
        const item =
          items.nth(
            index
          );

        const text =
          (
            await item
              .innerText()
              .catch(
                () =>
                  ""
              )
          )
            .replace(
              /\s+/g,
              " "
            )
            .trim();

        if (
          /partid|match|result|calend|fixture/i
            .test(
              text
            )
        ) {
          console.log({
            selector,
            text,

            href:
              await item
                .getAttribute(
                  "href"
                ),
          });
        }
      }
    }

    const control =
      await findMatchesControl(
        page
      );

    if (!control) {
      console.log(
        "\nMATCHES CONTROL NOT FOUND"
      );

      await page.screenshot({
        path:
          "/tmp/sofascore-team-before.png",

        fullPage:
          true,
      });

      return;
    }

    console.log(
      "\n===== CLICKING ====="
    );

    console.log(
      (
        await control
          .innerText()
          .catch(
            () =>
              ""
          )
      )
        .replace(
          /\s+/g,
          " "
        )
        .trim()
    );

    await control.click({
      timeout:
        10_000,
    });

    /*
     * Tiempo para debounce/navegación/carga.
     */
    await page.waitForTimeout(
      4000
    );

    console.log(
      "\nAFTER CLICK URL:"
    );

    console.log(
      page.url()
    );

    console.log(
      "\n===== PAGE TEXT AFTER CLICK ====="
    );

    const bodyText =
      await page
        .locator(
          "body"
        )
        .innerText();

    console.log(
      bodyText.slice(
        0,
        12000
      )
    );

    await fs.writeFile(
      "/tmp/sofascore-team-matches-body.txt",
      bodyText,
      "utf8"
    );

    await fs.writeFile(
      "/tmp/sofascore-team-matches-responses.json",
      JSON.stringify(
        relevantResponses,
        null,
        2
      ),
      "utf8"
    );

    await page.screenshot({
      path:
        "/tmp/sofascore-team-matches.png",

      fullPage:
        true,
    });

    console.log(
      "\nSAVED:"
    );

    console.log(
      "/tmp/sofascore-team-matches-body.txt"
    );

    console.log(
      "/tmp/sofascore-team-matches-responses.json"
    );

    console.log(
      "/tmp/sofascore-team-matches.png"
    );
  } finally {
    await browser.stop();
  }
}

void main();
