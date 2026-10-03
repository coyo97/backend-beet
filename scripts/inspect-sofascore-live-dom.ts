import {
  SofascoreBrowser,
} from "../src/modules/football/infrastructure/providers/sofascore-browser/SofascoreBrowser";

interface MatchLink {
  href:
    string;

  text:
    string;

  x:
    number;

  y:
    number;

  width:
    number;

  height:
    number;
}

async function collectVisibleMatchLinks(
  page:
    Awaited<
      ReturnType<
        SofascoreBrowser["getPage"]
      >
    >
): Promise<
  MatchLink[]
> {

  const links =
    page.locator(
      'a[href*="/football/match/"]:visible'
    );

  const count =
    await links.count();

  const result:
    MatchLink[] =
    [];

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

    const box =
      await link.boundingBox();

    if (!box) {
      continue;
    }

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

    result.push({
      href,
      text,

      x:
        Math.round(
          box.x
        ),

      y:
        Math.round(
          box.y
        ),

      width:
        Math.round(
          box.width
        ),

      height:
        Math.round(
          box.height
        ),
    });
  }

  return result;
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
      1800
    );

    await page.evaluate(
      () =>
        window.scrollTo(
          0,
          0
        )
    );

    const before =
      await collectVisibleMatchLinks(
        page
      );

    console.log(
      "\n=============================="
    );

    console.log(
      "BEFORE LIVE:",
      before.length
    );

    const liveButton =
      page.getByRole(
        "button",
        {
          name:
            /^(En vivo|En Vivo|Live)(?:\s*\(\d+\))?$/i,
        }
      )
        .first();

    console.log(
      "\nLIVE BUTTON:"
    );

    console.dir(
      await liveButton.evaluate(
        (
          element
        ) => ({
          text:
            (
              element.textContent ??
              ""
            )
              .replace(
                /\s+/g,
                " "
              )
              .trim(),

          class:
            element.getAttribute(
              "class"
            ),

          role:
            element.getAttribute(
              "role"
            ),

          ariaSelected:
            element.getAttribute(
              "aria-selected"
            ),

          ariaControls:
            element.getAttribute(
              "aria-controls"
            ),

          id:
            element.getAttribute(
              "id"
            ),
        })
      ),
      {
        depth:
          null,
      }
    );

    console.log(
      "\n===== ANCESTORS ====="
    );

    const ancestors =
      await liveButton.evaluate(
        (
          element
        ) => {

          const result:
            Array<
              Record<
                string,
                unknown
              >
            > =
            [];

          let current:
            HTMLElement | null =
              element as
                HTMLElement;

          for (
            let depth =
              0;

            depth <
              10 &&
            current;

            depth +=
              1
          ) {
            const rect =
              current
                .getBoundingClientRect();

            result.push({
              depth,

              tag:
                current
                  .tagName,

              id:
                current
                  .id ||
                null,

              role:
                current
                  .getAttribute(
                    "role"
                  ),

              class:
                current
                  .getAttribute(
                    "class"
                  ),

              ariaLabel:
                current
                  .getAttribute(
                    "aria-label"
                  ),

              text:
                (
                  current.innerText ??
                  ""
                )
                  .replace(
                    /\s+/g,
                    " "
                  )
                  .trim()
                  .slice(
                    0,
                    500
                  ),

              box: {
                x:
                  Math.round(
                    rect.x
                  ),

                y:
                  Math.round(
                    rect.y
                  ),

                width:
                  Math.round(
                    rect.width
                  ),

                height:
                  Math.round(
                    rect.height
                  ),
              },
            });

            current =
              current.parentElement;
          }

          return result;
        }
      );

    console.dir(
      ancestors,
      {
        depth:
          null,
      }
    );

    console.log(
      "\nCLICKING LIVE..."
    );

    await liveButton.click({
      timeout:
        10_000,
    });

    await page.waitForTimeout(
      1800
    );

    console.log(
      "ARIA SELECTED:",
      await liveButton
        .getAttribute(
          "aria-selected"
        )
    );

    const after =
      await collectVisibleMatchLinks(
        page
      );

    const beforeSet =
      new Set(
        before.map(
          (
            item
          ) =>
            item.href
        )
      );

    const afterSet =
      new Set(
        after.map(
          (
            item
          ) =>
            item.href
        )
      );

    const added =
      after.filter(
        (
          item
        ) =>
          !beforeSet.has(
            item.href
          )
      );

    const removed =
      before.filter(
        (
          item
        ) =>
          !afterSet.has(
            item.href
          )
      );

    const common =
      after.filter(
        (
          item
        ) =>
          beforeSet.has(
            item.href
          )
      );

    console.log(
      "\n=============================="
    );

    console.log(
      "AFTER LIVE:",
      after.length
    );

    console.log(
      "ADDED:",
      added.length
    );

    console.log(
      "REMOVED:",
      removed.length
    );

    console.log(
      "COMMON:",
      common.length
    );

    console.log(
      "\n===== ADDED AFTER LIVE ====="
    );

    console.dir(
      added,
      {
        depth:
          null,
      }
    );

    console.log(
      "\n===== REMOVED AFTER LIVE ====="
    );

    console.dir(
      removed,
      {
        depth:
          null,
      }
    );

    console.log(
      "\n===== ALL VISIBLE AFTER ====="
    );

    console.dir(
      after,
      {
        depth:
          null,
      }
    );

    /*
     * Inspeccionamos también todos los
     * elementos que Sofascore considera
     * seleccionados.
     */
    console.log(
      "\n===== SELECTED ELEMENTS ====="
    );

    const selected =
      await page.locator(
        '[aria-selected="true"]'
      )
        .evaluateAll(
          (
            elements
          ) =>
            elements.map(
              (
                element
              ) => ({
                tag:
                  element.tagName,

                text:
                  (
                    element.textContent ??
                    ""
                  )
                    .replace(
                      /\s+/g,
                      " "
                    )
                    .trim(),

                role:
                  element.getAttribute(
                    "role"
                  ),

                class:
                  element.getAttribute(
                    "class"
                  ),

                ariaControls:
                  element.getAttribute(
                    "aria-controls"
                  ),
              })
            )
        );

    console.dir(
      selected,
      {
        depth:
          null,
      }
    );

    /*
     * Screenshot para poder comprobar
     * visualmente qué zona quedó activa.
     */
    await page.screenshot({
      path:
        "/tmp/sofascore-live-selected.png",

      fullPage:
        false,
    });

    console.log(
      "\nSCREENSHOT:"
    );

    console.log(
      "/tmp/sofascore-live-selected.png"
    );
  } finally {
    await browser.stop();
  }
}

void main();
