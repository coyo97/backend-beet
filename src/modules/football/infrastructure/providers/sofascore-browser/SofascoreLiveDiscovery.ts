import type {
  Page,
} from "playwright";

import {
  SofascoreBrowser,
} from "./SofascoreBrowser";

export interface SofascoreDiscoveredMatch {
  url:
    string;

  text:
    string;
}

export class SofascoreLiveDiscovery {
  constructor(
    private readonly browser:
      SofascoreBrowser
  ) {}

  public async discover():
    Promise<
      SofascoreDiscoveredMatch[]
    > {

    const page =
      await this.browser
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

    await this.selectLive(
      page
    );

    /*
     * No usamos networkidle:
     * una página live puede mantener
     * conexiones abiertas constantemente.
     */
    await page.waitForTimeout(
      1_500
    );

    const matches =
      new Map<
        string,
        SofascoreDiscoveredMatch
      >();

    /*
     * Sofascore puede virtualizar partes
     * de una lista larga.
     *
     * Por eso recogemos enlaces mientras
     * vamos desplazándonos, en vez de
     * inspeccionar solamente el DOM final.
     */
    let scansWithoutNew =
      0;

    for (
      let scan =
        0;

      scan <
        35;

      scan +=
        1
    ) {
      const before =
        matches.size;

      await this.collectVisible(
        page,
        matches
      );

      if (
        matches.size ===
        before
      ) {
        scansWithoutNew +=
          1;
      } else {
        scansWithoutNew =
          0;
      }

      /*
       * Cinco desplazamientos consecutivos
       * sin descubrir nuevos partidos:
       * probablemente llegamos al final.
       */
      if (
        scansWithoutNew >=
        5
      ) {
        break;
      }

      await page.mouse.wheel(
        0,
        1000
      );

      await page.waitForTimeout(
        300
      );
    }

    console.log(
      `[SofascoreLive] discovered=${matches.size}`
    );

    return Array.from(
      matches.values()
    );
  }

  private async selectLive(
    page:
      Page
  ): Promise<void> {

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
      console.warn(
        "[SofascoreLive] live filter button not found"
      );

      return;
    }

    try {
      await liveButton
        .first()
        .click({
          timeout:
            10_000,
        });

      console.log(
        "[SofascoreLive] live filter selected"
      );
    } catch (
      error
    ) {
      console.warn(
        "[SofascoreLive] could not click live filter",
        error
      );
    }
  }

  private async collectVisible(
    page:
      Page,

    matches:
      Map<
        string,
        SofascoreDiscoveredMatch
      >
  ): Promise<void> {

    const links =
      page.locator(
        'a[href*="/football/match/"]'
      );

    const count =
      await links.count();

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
        await link.getAttribute(
          "href"
        );

      if (!href) {
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

      const url =
        href.startsWith(
          "http"
        )
          ? href
          : `https://www.sofascore.com${href}`;

      matches.set(
        url,
        {
          url,
          text,
        }
      );
    }
  }
}
