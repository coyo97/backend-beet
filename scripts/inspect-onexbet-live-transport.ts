import {
  chromium,
} from "playwright";

const url =
  process.env.ONEXBET_URL ??
  "https://bol.1xbet.com/en/live/football";

const needles = [
  "strani",
  "sternberk",
];

function containsTarget(
  value:
    string
): boolean {

  const normalized =
    value.toLowerCase();

  return needles.some(
    needle =>
      normalized.includes(
        needle
      )
  );
}

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
        width:
          1365,

        height:
          900,
      },
    });

  const page =
    await context.newPage();

  const candidateUrls =
    new Set<string>();

  /*
   * =====================================================
   * XHR / FETCH
   * =====================================================
   */
  page.on(
    "response",
    async response => {

      const request =
        response.request();

      const resourceType =
        request.resourceType();

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

      candidateUrls.add(
        responseUrl
      );

      let body =
        "";

      try {
        body =
          await response.text();
      } catch {
        return;
      }

      /*
       * Encontramos directamente
       * Strani/Sternberk.
       */
      if (
        containsTarget(
          body
        )
      ) {

        console.log(
          "\n===== HTTP TARGET FOUND ====="
        );

        console.log(
          "STATUS:",
          response.status()
        );

        console.log(
          "URL:",
          responseUrl
        );

        console.log(
          body.slice(
            0,
            8000
          )
        );

        return;
      }

      /*
       * También mostramos respuestas que
       * parecen contener catálogos live.
       */
      if (
        /firstOpponentName|secondOpponentName|gameId|champName|livefeed/i.test(
          body
        )
      ) {

        console.log(
          "\n===== POSSIBLE LIVE HTTP ====="
        );

        console.log(
          responseUrl
        );

        console.log(
          "bytes:",
          body.length
        );

        console.log(
          body.slice(
            0,
            1200
          )
        );
      }
    }
  );

  /*
   * =====================================================
   * WEBSOCKET
   * =====================================================
   */
  page.on(
    "websocket",
    socket => {

      console.log(
        "\n===== WEBSOCKET ====="
      );

      console.log(
        socket.url()
      );

      socket.on(
        "framereceived",
        event => {

          const payload =
            typeof event.payload ===
              "string"
              ? event.payload
              : event.payload
                  .toString();

          if (
            containsTarget(
              payload
            )
          ) {

            console.log(
              "\n===== WS TARGET FOUND ====="
            );

            console.log(
              socket.url()
            );

            console.log(
              payload.slice(
                0,
                8000
              )
            );

            return;
          }

          if (
            /firstOpponentName|secondOpponentName|gameId|champName/i.test(
              payload
            )
          ) {

            console.log(
              "\n===== POSSIBLE LIVE WS ====="
            );

            console.log(
              socket.url()
            );

            console.log(
              "bytes:",
              payload.length
            );

            console.log(
              payload.slice(
                0,
                1200
              )
            );
          }
        }
      );
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
   * Dejamos que cargue el SPA.
   */
  await page.waitForTimeout(
    20_000
  );

  /*
   * Scroll para provocar lazy loading
   * si el catálogo lo usa.
   */
  for (
    let index = 0;
    index < 6;
    index += 1
  ) {

    await page.mouse.wheel(
      0,
      1800
    );

    await page.waitForTimeout(
      1500
    );
  }

  const body =
    await page
      .locator("body")
      .innerText()
      .catch(
        () => ""
      );

  console.log(
    "\n===== FINAL PAGE ====="
  );

  console.log({
    pageUrl:
      page.url(),

    containsStrani:
      /strani/i.test(
        body
      ),

    containsSternberk:
      /sternberk/i.test(
        body
      ),

    textLength:
      body.length,

    xhrFetchCount:
      candidateUrls.size,
  });

  console.log(
    "\n===== XHR/FETCH URLS ====="
  );

  for (
    const candidateUrl
    of candidateUrls
  ) {

    if (
      /live|game|sport|bet|feed|event/i.test(
        candidateUrl
      )
    ) {
      console.log(
        candidateUrl
      );
    }
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
