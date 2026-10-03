import fs from "node:fs";

import {
  SofascoreBrowser,
} from "../src/modules/football/infrastructure/providers/sofascore-browser/SofascoreBrowser";

async function main():
  Promise<void> {

  const query =
    process.argv[2] ??
    "Guangdong Chenxing";

  const browser =
    new SofascoreBrowser();

  try {
    const page =
      await browser.getPage();

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
      1200
    );

    const seen =
      new Set<string>();

    page.on(
      "request",
      (
        request
      ) => {

        const type =
          request.resourceType();

        if (
          type !== "xhr" &&
          type !== "fetch"
        ) {
          return;
        }

        console.log(
          "\n[REQUEST]"
        );

        console.log(
          type.toUpperCase(),
          request.method(),
          request.url()
        );
      }
    );

    page.on(
      "response",
      async (
        response
      ) => {

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
          seen.has(
            url
          )
        ) {
          return;
        }

        seen.add(
          url
        );

        console.log(
          "\n[RESPONSE]"
        );

        console.log(
          response.status(),
          type.toUpperCase(),
          url
        );

        const contentType =
          response.headers()[
            "content-type"
          ] ??
          "";

        console.log(
          "CONTENT-TYPE:",
          contentType
        );

        /*
         * Guardamos cuerpos JSON/textuales
         * pequeños para inspección.
         */
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
                1800
              )
            );

            const safeName =
              `${seen.size}`
                .padStart(
                  3,
                  "0"
                );

            fs.writeFileSync(
              `/tmp/sofascore-search-${safeName}.txt`,
              body,
              "utf8"
            );
          } catch {
            // Ignoramos cuerpos no legibles.
          }
        }
      }
    );

    const searchButton =
      page.getByRole(
        "button",
        {
          name:
            /Buscar en Sofascore|Search Sofascore/i,
        }
      )
        .first();

    await searchButton.click({
      timeout:
        10_000,
    });

    await page.waitForTimeout(
      500
    );

    /*
     * Ya conocemos este placeholder
     * por tu prueba anterior.
     */
    const input =
      page.getByPlaceholder(
        /Busca partidos, competiciones, equipos, jugadores/i
      )
        .first();

    await input.waitFor({
      state:
        "visible",

      timeout:
        10_000,
    });

    console.log(
      "\nSEARCH INPUT FOUND"
    );

    /*
     * No usamos fill esta vez.
     *
     * pressSequentially genera las
     * pulsaciones reales que puede estar
     * esperando el debounce del buscador.
     */
    await input.click();

    await input.pressSequentially(
      query,
      {
        delay:
          90,
      }
    );

    console.log(
      "VALUE:",
      await input.inputValue()
    );

    /*
     * Dejamos tiempo suficiente para
     * debounce + request + render.
     */
    await page.waitForTimeout(
      4000
    );

    console.log(
      "\n===== VISIBLE DIALOG TEXT ====="
    );

    const dialogs =
      page.locator(
        '[role="dialog"]:visible'
      );

    console.log(
      "DIALOGS:",
      await dialogs.count()
    );

    for (
      let index =
        0;

      index <
        await dialogs.count();

      index +=
        1
    ) {
      const dialog =
        dialogs.nth(
          index
        );

      console.log(
        `\n--- DIALOG ${index} ---`
      );

      console.log(
        (
          await dialog
            .innerText()
            .catch(
              () =>
                ""
            )
        )
          .slice(
            0,
            5000
          )
      );

      console.log(
        "\nLINKS:"
      );

      const links =
        dialog.locator(
          "a"
        );

      for (
        let linkIndex =
          0;

        linkIndex <
          Math.min(
            await links.count(),
            30
          );

        linkIndex +=
          1
      ) {
        const link =
          links.nth(
            linkIndex
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
     * También buscamos texto visible que
     * contenga alguna palabra de la consulta.
     */
    console.log(
      "\n===== QUERY TEXT MATCHES ====="
    );

    const firstToken =
      query
        .split(
          /\s+/
        )[0];

    const textMatches =
      page.getByText(
        new RegExp(
          firstToken,
          "i"
        )
      );

    console.log(
      "COUNT:",
      await textMatches.count()
    );

    for (
      let index =
        0;

      index <
        Math.min(
          await textMatches.count(),
          20
        );

      index +=
        1
    ) {
      const item =
        textMatches.nth(
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

    await page.screenshot({
      path:
        "/tmp/sofascore-search.png",

      fullPage:
        false,
    });

    console.log(
      "\nSCREENSHOT:"
    );

    console.log(
      "/tmp/sofascore-search.png"
    );
  } finally {
    await browser.stop();
  }
}

void main();
