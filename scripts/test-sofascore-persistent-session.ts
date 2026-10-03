import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { createInterface } from "node:readline/promises";
import {
  stdin as input,
  stdout as output,
} from "node:process";

async function main(): Promise<void> {
  const profileDir =
    path.join(
      os.homedir(),
      ".cache",
      "football-radar",
      "sofascore-profile"
    );

  console.log(
    "PROFILE:",
    profileDir
  );

  const context =
    await chromium.launchPersistentContext(
      profileDir,
      {
        headless: false,

        locale:
          "es-ES",

        timezoneId:
          "America/La_Paz",

        viewport: {
          width: 1365,
          height: 900,
        },
      }
    );

  const pages =
    context.pages();

  const page =
    pages[0] ??
    await context.newPage();

  try {
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

    console.log(
      "\nINITIAL TITLE:",
      await page.title()
    );

    console.log(
      "INITIAL URL:",
      page.url()
    );

    if (
      page.url()
        .includes(
          "/captcha"
        )
    ) {
      console.log(
        "\n================================"
      );

      console.log(
        "SOFASCORE CHALLENGE DETECTED"
      );

      console.log(
        "Resuelve manualmente el challenge"
      );

      console.log(
        "en la ventana de Chromium."
      );

      console.log(
        "Cuando SofaScore cargue normalmente,"
      );

      console.log(
        "vuelve a esta terminal."
      );

      console.log(
        "================================\n"
      );

      const rl =
        createInterface({
          input,
          output,
        });

      await rl.question(
        "Pulsa ENTER cuando hayas terminado: "
      );

      rl.close();

      await page.waitForTimeout(
        1500
      );
    }

    console.log(
      "\nFINAL TITLE:",
      await page.title()
    );

    console.log(
      "FINAL URL:",
      page.url()
    );

    const nextData =
      page.locator(
        "script#__NEXT_DATA__"
      );

    console.log(
      "\nNEXT_DATA:",
      await nextData.count()
    );

    console.log(
      "\n===== BUTTONS ====="
    );

    const buttons =
      await page
        .locator(
          "button:visible"
        )
        .evaluateAll(
          elements =>
            elements
              .slice(
                0,
                100
              )
              .map(
                element => ({
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

                  ariaLabel:
                    element.getAttribute(
                      "aria-label"
                    ),

                  role:
                    element.getAttribute(
                      "role"
                    ),
                })
              )
        );

    console.dir(
      buttons,
      {
        depth:
          null,
      }
    );

    console.log(
      "\n===== FOOTBALL MATCH LINKS ====="
    );

    const matches =
      await page
        .locator(
          'a[href*="/football/match/"]'
        )
        .evaluateAll(
          elements =>
            elements
              .slice(
                0,
                100
              )
              .map(
                element => ({
                  href:
                    element.getAttribute(
                      "href"
                    ),

                  text:
                    (
                      (
                        element as HTMLElement
                      ).innerText ??
                      ""
                    )
                      .replace(
                        /\s+/g,
                        " "
                      )
                      .trim(),
                })
              )
        );

    console.log(
      "MATCH LINKS:",
      matches.length
    );

    console.dir(
      matches,
      {
        depth:
          null,
      }
    );

    await page
      .screenshot({
        path:
          "/tmp/sofascore-session.png",

        fullPage:
          false,
      });

    console.log(
      "\nSCREENSHOT:",
      "/tmp/sofascore-session.png"
    );

    console.log(
      "\nLa sesión queda guardada en:"
    );

    console.log(
      profileDir
    );
  } finally {
    await context.close();
  }
}

void main();
