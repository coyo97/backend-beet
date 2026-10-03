import fs from "node:fs/promises";

import {
  chromium,
} from "playwright";

import {
  OneXBetLiveClient,
} from "../src/modules/football/infrastructure/providers/onexbet/OneXBetLiveClient";

import {
  OneXBetLiveHtmlParser,
} from "../src/modules/football/infrastructure/providers/onexbet/OneXBetLiveHtmlParser";

async function main():
  Promise<void> {

  const liveUrl =
    process.env
      .ONEXBET_LIVE_URL ??
    "https://afg.1xbet.com/en/live/football";

  /*
   * Buscamos un candidato H2H actual
   * para no depender de IDs antiguos.
   */
  const client =
    new OneXBetLiveClient(
      liveUrl
    );

  const parser =
    new OneXBetLiveHtmlParser();

  const liveHtml =
    await client
      .getLiveHtml();

  const games =
    parser.parse(
      liveHtml
    );

  const candidate =
    games.find(
      (
        game
      ) =>
        game.hasHeadToHead &&
        game.gameNameForUrl &&
        game.championshipId
    );

  if (!candidate) {
    console.log(
      "No current H2H candidate."
    );

    return;
  }

  const baseUrl =
    new URL(
      liveUrl
    ).origin;

  const competitionSlug =
    candidate
      .competitionName
      .toLowerCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      );

  const detailUrl =
    `${baseUrl}/en/live/football/${candidate.championshipId}-${competitionSlug}/${candidate.gameNameForUrl}`;

  console.log(
    "CANDIDATE:"
  );

  console.log(
    candidate.homeName,
    "vs",
    candidate.awayName
  );

  console.log(
    "DETAIL URL:"
  );

  console.log(
    detailUrl
  );

  const browser =
    await chromium.launch({
      headless:
        true,
    });

  try {
    const context =
      await browser
        .newContext({
          locale:
            "en-US",

          viewport: {
            width:
              1365,

            height:
              1000,
          },
        });

    const page =
      await context
        .newPage();

    const responses:
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
            "xhr" &&
          resourceType !==
            "fetch"
        ) {
          return;
        }

        const responseUrl =
          response.url();

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

        responses.push({
          status:
            response.status(),

          url:
            responseUrl,

          contentType,

          body,
        });

        if (
          /head|h2h|history|recent|last|stat|team|game/i
            .test(
              responseUrl
            )
        ) {
          console.log(
            "\n[INTERESTING RESPONSE]"
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
                2500
              )
            );
          }
        }
      }
    );

    /*
     * Entramos primero al live para tener
     * la sesión normal del sitio.
     */
    await page.goto(
      liveUrl,
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

    /*
     * Luego abrimos el partido.
     */
    await page.goto(
      detailUrl,
      {
        waitUntil:
          "domcontentloaded",

        timeout:
          30_000,
      }
    );

    await page.waitForTimeout(
      3500
    );

    console.log(
      "\nTITLE:"
    );

    console.log(
      await page.title()
    );

    console.log(
      "\nFINAL URL:"
    );

    console.log(
      page.url()
    );

    const beforeText =
      await page
        .locator(
          "body"
        )
        .innerText();

    await fs.writeFile(
      "/tmp/onexbet-detail-before.txt",
      beforeText,
      "utf8"
    );

    console.log(
      "\n===== POSSIBLE H2H CONTROLS ====="
    );

    const selectors = [
      '[role="tab"]:visible',
      'button:visible',
      'a:visible',
    ];

    for (
      const selector
      of selectors
    ) {
      const items =
        page.locator(
          selector
        );

      const count =
        Math.min(
          await items.count(),
          150
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
          /head.?to.?head|h2h|previous|recent|last.?games|form|history/i
            .test(
              text
            )
        ) {
          console.log({
            selector,
            index,
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

    /*
     * Intentamos abrir específicamente
     * Head to Head.
     */
    const patterns =
      /Head\s*to\s*Head|H2H/i;

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

    let clicked =
      false;

    for (
      const locator
      of candidates
    ) {
      const count =
        await locator.count();

      for (
        let index =
          0;

        index <
          count;

        index +=
          1
      ) {
        const item =
          locator.nth(
            index
          );

        if (
          !await item
            .isVisible()
            .catch(
              () =>
                false
            )
        ) {
          continue;
        }

        console.log(
          "\nCLICKING H2H:"
        );

        console.log(
          await item
            .innerText()
            .catch(
              () =>
                "?"
            )
        );

        await item.click({
          timeout:
            10_000,
        });

        clicked =
          true;

        break;
      }

      if (clicked) {
        break;
      }
    }

    if (!clicked) {
      console.log(
        "\nH2H control not found."
      );
    }

    await page.waitForTimeout(
      3500
    );

    const afterText =
      await page
        .locator(
          "body"
        )
        .innerText();

    const renderedHtml =
      await page.content();

    await fs.writeFile(
      "/tmp/onexbet-detail-after.txt",
      afterText,
      "utf8"
    );

    await fs.writeFile(
      "/tmp/onexbet-detail.html",
      renderedHtml,
      "utf8"
    );

    await fs.writeFile(
      "/tmp/onexbet-detail-responses.json",
      JSON.stringify(
        responses,
        null,
        2
      ),
      "utf8"
    );

    await page.screenshot({
      path:
        "/tmp/onexbet-detail.png",

      fullPage:
        true,
    });

    console.log(
      "\nSAVED:"
    );

    console.log(
      "/tmp/onexbet-detail-before.txt"
    );

    console.log(
      "/tmp/onexbet-detail-after.txt"
    );

    console.log(
      "/tmp/onexbet-detail-responses.json"
    );

    console.log(
      "/tmp/onexbet-detail.html"
    );

    console.log(
      "/tmp/onexbet-detail.png"
    );
  } finally {
    await browser.close();
  }
}

void main();
