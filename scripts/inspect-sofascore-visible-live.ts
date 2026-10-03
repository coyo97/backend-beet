import {
  SofascoreBrowser,
} from "../src/modules/football/infrastructure/providers/sofascore-browser/SofascoreBrowser";

interface VisibleMatch {
  id:
    string | null;

  url:
    string;

  text:
    string;

  context:
    string;
}

function extractMatchId(
  url:
    string
): string | null {

  const hashMatch =
    url.match(
      /#id:(\d+)/
    );

  if (
    hashMatch
  ) {
    return hashMatch[1];
  }

  return null;
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

    const liveButton =
      page.getByRole(
        "button",
        {
          name:
            /^(En vivo|En Vivo|Live)(?:\s*\(\d+\))?$/i,
        }
      );

    const count =
      await liveButton.count();

    if (
      count ===
      0
    ) {
      throw new Error(
        "Live filter not found"
      );
    }

    await liveButton
      .first()
      .click({
        timeout:
          10_000,
      });

    await page.waitForTimeout(
      1500
    );

    console.log(
      "LIVE SELECTED:",
      await liveButton
        .first()
        .getAttribute(
          "aria-selected"
        )
    );

    const discovered =
      new Map<
        string,
        VisibleMatch
      >();

    let emptyScans =
      0;

    /*
     * Sofascore puede virtualizar
     * la lista.
     *
     * Recorremos la página, pero
     * SOLO recogemos anchors visibles.
     */
    for (
      let scan =
        0;

      scan <
        30;

      scan +=
        1
    ) {
      const before =
        discovered.size;

      const links =
        page.locator(
          'a[href*="/football/match/"]:visible'
        );

      const linkCount =
        await links.count();

      for (
        let index =
          0;

        index <
          linkCount;

        index +=
          1
      ) {
        const link =
          links.nth(
            index
          );

        /*
         * Comprobación adicional.
         */
        if (
          !await link.isVisible()
        ) {
          continue;
        }

        const href =
          await link.getAttribute(
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

        let text =
          "";

        try {
          text =
            (
              await link.innerText()
            )
              .replace(
                /\s+/g,
                " "
              )
              .trim();
        } catch {
          text =
            "";
        }

        /*
         * Algunos anchors de Sofascore
         * son overlays y no contienen
         * directamente los nombres.
         *
         * Caminamos unos pocos padres
         * buscando el texto visible
         * correspondiente a la tarjeta.
         */
        const context =
          await link.evaluate(
            (
              element
            ) => {

              let current:
                HTMLElement | null =
                  element as
                    HTMLElement;

              let best =
                "";

              for (
                let depth =
                  0;

                depth <
                  5 &&
                current;

                depth +=
                  1
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
                  500
                ) {
                  best =
                    value;
                }

                current =
                  current.parentElement;
              }

              return best;
            }
          );

        discovered.set(
          url,
          {
            id:
              extractMatchId(
                url
              ),

            url,

            text,

            context,
          }
        );
      }

      if (
        discovered.size ===
        before
      ) {
        emptyScans +=
          1;
      } else {
        emptyScans =
          0;
      }

      if (
        emptyScans >=
        5
      ) {
        break;
      }

      await page.mouse.wheel(
        0,
        900
      );

      await page.waitForTimeout(
        350
      );
    }

    console.log(
      "\nVISIBLE MATCHES:",
      discovered.size
    );

    console.log(
      "\n========================================"
    );

    let number =
      0;

    for (
      const match
      of discovered.values()
    ) {
      number +=
        1;

      console.log(
        `\n${number}. ID=${match.id}`
      );

      console.log(
        "TEXT:",
        match.text ||
        "(empty)"
      );

      console.log(
        "CONTEXT:",
        match.context ||
        "(empty)"
      );

      console.log(
        "URL:",
        match.url
      );
    }

    console.log(
      "\n========================================"
    );
  } finally {
    await browser.stop();
  }
}

void main();
