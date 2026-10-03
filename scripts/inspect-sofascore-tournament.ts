import {
  SofascoreBrowser,
} from "../src/modules/football/infrastructure/providers/sofascore-browser/SofascoreBrowser";

const URL =
  "https://www.sofascore.com/es/football/tournament/russia-amateur/championship-sff-sibir/20768#id:90865";

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

    console.log(
      "TITLE:",
      await page.title()
    );

    console.log(
      "URL:",
      page.url()
    );

    /*
     * Encabezados visibles.
     */
    console.log(
      "\n===== HEADINGS ====="
    );

    const headings =
      await page.locator(
        "h1:visible, h2:visible, h3:visible, h4:visible"
      )
        .allInnerTexts();

    console.dir(
      headings.map(
        (
          text
        ) =>
          text
            .replace(
              /\s+/g,
              " "
            )
            .trim()
      ),
      {
        depth:
          null,
      }
    );

    /*
     * Botones/tabs relevantes.
     */
    console.log(
      "\n===== BUTTONS / TABS ====="
    );

    const buttons =
      await page.locator(
        'button:visible, [role="tab"]:visible'
      )
        .allInnerTexts();

    console.dir(
      buttons
        .map(
          (
            text
          ) =>
            text
              .replace(
                /\s+/g,
                " "
              )
              .trim()
        )
        .filter(
          Boolean
        ),
      {
        depth:
          null,
      }
    );

    /*
     * Intentamos abrir la sección
     * de clasificación si existe.
     */
    const standingsControl =
      page.getByText(
        /^(Clasificación|Clasificaciones|Standings|Tabla)$/i
      );

    const standingsCount =
      await standingsControl.count();

    console.log(
      "\nSTANDINGS CONTROLS:",
      standingsCount
    );

    if (
      standingsCount >
      0
    ) {
      const control =
        standingsControl.first();

      if (
        await control.isVisible()
      ) {
        try {
          await control.click({
            timeout:
              5000,
          });

          console.log(
            "STANDINGS CLICKED"
          );

          await page.waitForTimeout(
            1200
          );
        } catch (
          error
        ) {
          console.log(
            "STANDINGS CLICK FAILED:",
            error
          );
        }
      }
    }

    /*
     * Primero buscamos tablas HTML
     * convencionales.
     */
    console.log(
      "\n===== TABLE ROWS ====="
    );

    const tableRows =
      page.locator(
        "table:visible tr:visible"
      );

    console.log(
      "TABLE ROW COUNT:",
      await tableRows.count()
    );

    for (
      let index =
        0;

      index <
        Math.min(
          await tableRows.count(),
          50
        );

      index +=
        1
    ) {
      const text =
        (
          await tableRows
            .nth(
              index
            )
            .innerText()
        )
          .replace(
            /\s+/g,
            " "
          )
          .trim();

      if (text) {
        console.log(
          `${index + 1}.`,
          text
        );
      }
    }

    /*
     * Sofascore suele usar divs en vez
     * de <table>. Buscamos role=row.
     */
    console.log(
      "\n===== ROLE ROWS ====="
    );

    const roleRows =
      page.locator(
        '[role="row"]:visible'
      );

    console.log(
      "ROLE ROW COUNT:",
      await roleRows.count()
    );

    for (
      let index =
        0;

      index <
        Math.min(
          await roleRows.count(),
          50
        );

      index +=
        1
    ) {
      const text =
        (
          await roleRows
            .nth(
              index
            )
            .innerText()
        )
          .replace(
            /\s+/g,
            " "
          )
          .trim();

      if (text) {
        console.log(
          `${index + 1}.`,
          text
        );
      }
    }

    /*
     * Extraemos enlaces de equipos que
     * haya dentro del contenido principal.
     */
    console.log(
      "\n===== TEAM-LIKE LINKS ====="
    );

    const links =
      page.locator(
        'main a:visible, [role="main"] a:visible'
      );

    const seen =
      new Set<
        string
      >();

    for (
      let index =
        0;

      index <
        Math.min(
          await links.count(),
          150
        );

      index +=
        1
    ) {
      const link =
        links.nth(
          index
        );

      const href =
        await link.getAttribute(
          "href"
        );

      const text =
        (
          await link.innerText()
            .catch(
              () => ""
            )
        )
          .replace(
            /\s+/g,
            " "
          )
          .trim();

      if (
        !href ||
        !text
      ) {
        continue;
      }

      const key =
        `${text}|${href}`;

      if (
        seen.has(
          key
        )
      ) {
        continue;
      }

      seen.add(
        key
      );

      if (
        /team|equipo|football/i.test(
          href
        )
      ) {
        console.log(
          text,
          "=>",
          href
        );
      }
    }

    /*
     * Texto alrededor de palabras clave.
     */
    console.log(
      "\n===== STANDINGS TEXT CONTEXT ====="
    );

    const bodyText =
      (
        await page.locator(
          "body"
        )
          .innerText()
      )
        .replace(
          /\r/g,
          ""
        );

    const lines =
      bodyText
        .split(
          "\n"
        )
        .map(
          (
            line
          ) =>
            line.trim()
        )
        .filter(
          Boolean
        );

    const keywords =
      [
        "Clasificación",
        "Standings",
        "Pos.",
        "PTS",
        "PJ",
        "Puntos",
      ];

    for (
      let index =
        0;

      index <
        lines.length;

      index +=
        1
    ) {
      if (
        !keywords.some(
          (
            keyword
          ) =>
            lines[index]
              .toLowerCase()
              .includes(
                keyword
                  .toLowerCase()
              )
        )
      ) {
        continue;
      }

      console.log(
        "\n--- CONTEXT ---"
      );

      console.log(
        lines
          .slice(
            Math.max(
              0,
              index -
                5
            ),
            Math.min(
              lines.length,
              index +
                30
            )
          )
          .join(
            "\n"
          )
      );
    }

    await page.screenshot({
      path:
        "/tmp/sofascore-sibir-tournament.png",

      fullPage:
        true,
    });

    console.log(
      "\nSCREENSHOT:"
    );

    console.log(
      "/tmp/sofascore-sibir-tournament.png"
    );
  } finally {
    await browser.stop();
  }
}

void main();
