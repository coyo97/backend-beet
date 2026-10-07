import {
  chromium,
} from "playwright";

const url =
  process.env.ONEXBET_URL ??
  "https://afg.1xbet.com/en/live/football";

async function main() {

  const browser =
    await chromium.launch({
      headless: true,
    });

  const page =
    await browser.newPage();

  const interestingResponses:
    string[] =
    [];

  page.on(
    "response",
    response => {

      const responseUrl =
        response.url();

      if (
        /live|game|sport|betting/i.test(
          responseUrl
        )
      ) {
        interestingResponses.push(
          responseUrl
        );
      }
    }
  );

  console.log(
    "OPEN:",
    url
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

  /*
   * Dejamos que la app JS cargue
   * los partidos adicionales.
   */
  await page.waitForTimeout(
    8_000
  );

  const text =
    await page
      .locator("body")
      .innerText()
      .catch(
        () => ""
      );

  console.log({
    pageUrl:
      page.url(),

    bodyContainsStrani:
      /strani/i.test(
        text
      ),

    bodyContainsSternberk:
      /sternberk/i.test(
        text
      ),

    textLength:
      text.length,
  });

  console.log(
    "===== POSSIBLE LIVE API RESPONSES ====="
  );

  for (
    const item
    of Array.from(
      new Set(
        interestingResponses
      )
    )
  ) {
    console.log(
      item
    );
  }

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
