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
   * Primero obtenemos los candidatos
   * de UNA captura actual.
   */
  const client =
    new OneXBetLiveClient(
      liveUrl
    );

  const parser =
    new OneXBetLiveHtmlParser();

  const html =
    await client
      .getLiveHtml();

  const games =
    parser.parse(
      html
    );

  const candidates =
    games.filter(
      (
        game
      ) =>
        game.hasHeadToHead &&
        game.gameNameForUrl
    );

  console.log(
    "LIVE GAMES:",
    games.length
  );

  console.log(
    "H2H CANDIDATES:",
    candidates.length
  );

  if (
    candidates.length ===
    0
  ) {
    console.log(
      "No H2H candidates available."
    );

    return;
  }

  for (
    const candidate
    of candidates
  ) {
    console.log(
      "\nCANDIDATE:"
    );

    console.log({
      id:
        candidate.id,

      match:
        `${candidate.homeName} vs ${candidate.awayName}`,

      gameNameForUrl:
        candidate.gameNameForUrl,
    });
  }

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
              900,
          },
        });

    const page =
      await context
        .newPage();

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
      3000
    );

    console.log(
      "\nPAGE:"
    );

    console.log(
      page.url()
    );

    console.log(
      "\nTITLE:"
    );

    console.log(
      await page.title()
    );

    for (
      const candidate
      of candidates
    ) {
      const slug =
        candidate
          .gameNameForUrl;

      if (!slug) {
        continue;
      }

      console.log(
        "\n================================"
      );

      console.log(
        candidate.homeName,
        "vs",
        candidate.awayName
      );

      console.log(
        "slug:",
        slug
      );

      /*
       * 1. Búsqueda exacta en href.
       */
      const directLinks =
        page.locator(
          `a[href*="${slug}"]`
        );

      const directCount =
        await directLinks.count();

      console.log(
        "DIRECT LINKS:",
        directCount
      );

      for (
        let index =
          0;

        index <
          directCount;

        index +=
          1
      ) {
        const link =
          directLinks.nth(
            index
          );

        console.log({
          text:
            (
              await link
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
              .trim(),

          href:
            await link
              .getAttribute(
                "href"
              ),
        });
      }

      /*
       * 2. Por ID solamente.
       */
      const idLinks =
        page.locator(
          `a[href*="${candidate.id}"]`
        );

      const idCount =
        await idLinks.count();

      console.log(
        "ID LINKS:",
        idCount
      );

      for (
        let index =
          0;

        index <
          Math.min(
            idCount,
            20
          );

        index +=
          1
      ) {
        const link =
          idLinks.nth(
            index
          );

        console.log({
          text:
            (
              await link
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
              .trim(),

          href:
            await link
              .getAttribute(
                "href"
              ),
        });
      }
    }

    /*
     * Si los eventos no usan <a>,
     * buscamos los slugs en el HTML
     * renderizado.
     */
    const renderedHtml =
      await page.content();

    for (
      const candidate
      of candidates
    ) {
      const slug =
        candidate
          .gameNameForUrl;

      if (!slug) {
        continue;
      }

      const index =
        renderedHtml.indexOf(
          slug
        );

      console.log(
        "\nHTML SEARCH:",
        slug,
        "=>",
        index
      );

      if (
        index !==
        -1
      ) {
        console.log(
          renderedHtml.slice(
            Math.max(
              0,
              index -
                700
            ),

            Math.min(
              renderedHtml.length,
              index +
                1200
            )
          )
        );
      }
    }
  } finally {
    await browser.close();
  }
}

void main();
