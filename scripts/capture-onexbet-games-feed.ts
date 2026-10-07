import {
  chromium,
} from "playwright";

async function main() {

  const browser =
    await chromium.launch({
      headless: true,
    });

  const context =
    await browser.newContext({
      locale:
        "en-US",

      viewport: {
        width: 1365,
        height: 900,
      },
    });

  const page =
    await context.newPage();

  let captured =
    0;

  page.on(
    "response",
    async response => {

      const url =
        response.url();

      if (
        !url.includes(
          "/service-api/main-live-feed/v3/games1x2"
        )
      ) {
        return;
      }

      captured +=
        1;

      console.log(
        "\n===== GAMES FEED ====="
      );

      console.log(
        "STATUS:",
        response.status()
      );

      console.log(
        "URL:",
        url
      );

      console.log(
        "CONTENT-TYPE:",
        response.headers()[
          "content-type"
        ]
      );

      try {

        const body =
          await response.text();

        console.log(
          "BYTES:",
          body.length
        );

        console.log(
          "STRANI:",
          /strani/i.test(
            body
          )
        );

        console.log(
          "STERNBERK:",
          /sternberk/i.test(
            body
          )
        );

        const path =
          `/tmp/onexbet-games-${captured}.json`;

        await import(
          "node:fs/promises"
        ).then(
          fs =>
            fs.writeFile(
              path,
              body,
              "utf8"
            )
        );

        console.log(
          "SAVED:",
          path
        );

      } catch (
        error
      ) {

        console.error(
          "BODY ERROR:",
          error
        );
      }
    }
  );

  await page.goto(
    "https://bol.1xbet.com/en/live/football",
    {
      waitUntil:
        "domcontentloaded",

      timeout:
        30_000,
    }
  );

  await page.waitForTimeout(
    20_000
  );

  console.log(
    "\nTOTAL FEEDS:",
    captured
  );

  await browser.close();
}

main().catch(
  error => {

    console.error(
      error
    );

    process.exitCode =
      1;
  }
);
