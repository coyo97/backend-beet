import {
  chromium,
  type Page,
} from "playwright";

import {
  writeFile,
} from "node:fs/promises";

interface TeamTarget {
  name:
    string;

  id:
    string;

  url:
    string;
}

const teams:
  TeamTarget[] =
[
  {
    name:
      "Guangdong Chenxing Juli",

    id:
      "1233111",

    url:
      "https://www.sofascore.com/football/team/guangdong-chenxing-chuangert/1233111",
  },

  {
    name:
      "Wuhan Lianzhen FC",

    id:
      "1079261",

    url:
      "https://www.sofascore.com/football/team/wuhan-lianzhen-fc/1079261",
  },
];

function normalize(
  value:
    string
): string {

  return value
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

async function tryClickFinished(
  page:
    Page
): Promise<void> {

  const patterns = [
    /Finished/i,
    /Completed/i,
    /Results/i,
  ];

  for (
    const pattern
    of patterns
  ) {

    const candidates = [
      page.getByRole(
        "button",
        {
          name:
            pattern,
        }
      ),

      page.getByRole(
        "tab",
        {
          name:
            pattern,
        }
      ),

      page.getByText(
        pattern,
        {
          exact:
            true,
        }
      ),
    ];

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

        const visible =
          await item
            .isVisible()
            .catch(
              () =>
                false
            );

        if (!visible) {
          continue;
        }

        console.log(
          "CLICK:",
          await item
            .innerText()
            .catch(
              () =>
                "?"
            )
        );

        await item
          .click({
            timeout:
              5_000,
          })
          .catch(
            () =>
              undefined
          );

        await page
          .waitForTimeout(
            1_000
          );

        return;
      }
    }
  }
}

async function inspectTeam(
  page:
    Page,

  team:
    TeamTarget
): Promise<void> {

  console.log(
    "\n========================================"
  );

  console.log(
    team.name
  );

  console.log(
    "========================================"
  );

  await page.goto(
    team.url,
    {
      waitUntil:
        "domcontentloaded",

      timeout:
        30_000,
    }
  );

  await page.waitForTimeout(
    2_500
  );

  console.log(
    "TITLE:",
    await page.title()
  );

  console.log(
    "URL:",
    page.url()
  );

  await tryClickFinished(
    page
  );

  await page.waitForTimeout(
    1_500
  );

  const bodyText =
    await page
      .locator(
        "body"
      )
      .innerText();

  const html =
    await page.content();

  await writeFile(
    `/tmp/sofascore-team-${team.id}.txt`,
    bodyText,
    "utf8"
  );

  await writeFile(
    `/tmp/sofascore-team-${team.id}.html`,
    html,
    "utf8"
  );

  console.log(
    "\nBODY HAS TEAM:",
    bodyText
      .toLowerCase()
      .includes(
        team.name
          .toLowerCase()
      )
  );

  /*
   * Sofascore suele enlazar cada
   * partido a /football/match/...
   */
  const links =
    page.locator(
      'a[href*="/football/match/"]'
    );

  const count =
    await links.count();

  console.log(
    "MATCH LINKS:",
    count
  );

  const seen =
    new Set<
      string
    >();

  for (
    let index =
      0;

    index <
      count;

    index +=
      1
  ) {

    const link =
      links.nth(
        index
      );

    const href =
      await link
        .getAttribute(
          "href"
        );

    if (
      !href ||
      seen.has(
        href
      )
    ) {
      continue;
    }

    seen.add(
      href
    );

    const text =
      normalize(
        await link
          .innerText()
          .catch(
            () =>
              ""
          )
      );

    console.log(
      "\nMATCH"
    );

    console.log(
      "href:",
      href
    );

    console.log(
      "text:",
      text
    );
  }

  /*
   * También buscamos bloques visibles
   * con los nombres conocidos de la
   * competición y fechas/marcadores.
   */
  console.log(
    "\n===== RELEVANT BODY LINES ====="
  );

  const lines =
    bodyText
      .split(
        "\n"
      )
      .map(
        normalize
      )
      .filter(
        Boolean
      );

  for (
    let index =
      0;

    index <
      lines.length;

    index +=
      1
  ) {

    const line =
      lines[
        index
      ];

    if (
      /Chinese Champions|CMCL|Wuhan|Guangdong|Sichuan|Shenzhen|Chongqing|Guangzhou/i
        .test(
          line
        ) ||
      /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/
        .test(
          line
        )
    ) {

      const from =
        Math.max(
          0,
          index -
            2
        );

      const to =
        Math.min(
          lines.length,
          index +
            3
        );

      console.log(
        lines
          .slice(
            from,
            to
          )
          .join(
            " | "
          )
      );
    }
  }

  console.log(
    "\nSAVED:",
    `/tmp/sofascore-team-${team.id}.txt`
  );

  console.log(
    "SAVED:",
    `/tmp/sofascore-team-${team.id}.html`
  );
}

async function main():
  Promise<void> {

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

          timezoneId:
            "America/La_Paz",

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

    for (
      const team
      of teams
    ) {
      await inspectTeam(
        page,
        team
      );
    }

  } finally {

    await browser.close();
  }
}

void main();
