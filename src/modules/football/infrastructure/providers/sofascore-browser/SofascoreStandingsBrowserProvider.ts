import {
  SofascoreBrowser,
} from "./SofascoreBrowser";

import {
  SofascoreNextDataStandingsParser,
} from "./SofascoreNextDataStandingsParser";

import type {
  SofascoreStandings,
  SofascoreStandingsSelection,
} from "./SofascoreStandings";

interface CacheEntry {
  expiresAt:
    number;

  value:
    SofascoreStandings;
}

export class SofascoreStandingsBrowserProvider {
  private readonly cache =
    new Map<
      string,
      CacheEntry
    >();

  constructor(
    private readonly browser:
      SofascoreBrowser,

    private readonly parser =
      new SofascoreNextDataStandingsParser(),

    private readonly cacheMs =
      10 *
      60 *
      1000
  ) {}

  public async getStandings(
    url:
      string,

    selection:
      SofascoreStandingsSelection =
      {}
  ): Promise<
    SofascoreStandings
  > {

    const cacheKey =
      this.getCacheKey(
        url,
        selection
      );

    const cached =
      this.cache.get(
        cacheKey
      );

    if (
      cached &&
      cached.expiresAt >
        Date.now()
    ) {
      return cached.value;
    }

    const page =
      await this.browser
        .getPage();

    await page.goto(
      url,
      {
        waitUntil:
          "domcontentloaded",

        timeout:
          30_000,
      }
    );

    const nextData =
      page.locator(
        "script#__NEXT_DATA__"
      );

    await nextData.waitFor({
      state:
        "attached",

      timeout:
        15_000,
    });

    const raw =
      await nextData
        .textContent();

    if (!raw) {
      throw new Error(
        "Sofascore __NEXT_DATA__ is empty"
      );
    }

    const standings =
      this.parser.parse(
        raw,
        url,
        selection
      );

    this.cache.set(
      cacheKey,
      {
        expiresAt:
          Date.now() +
          this.cacheMs,

        value:
          standings,
      }
    );

    console.log(
      "[SofascoreStandings]",
      standings.tournamentName,
      selection.tournamentId
        ? `tournamentId=${selection.tournamentId}`
        : "tournamentId=auto",
      `rows=${standings.rows.length}`
    );

    return standings;
  }

  private getCacheKey(
    url:
      string,

    selection:
      SofascoreStandingsSelection
  ): string {

    return [
      url,
      "tournament",
      selection.tournamentId ??
        "auto",
    ].join(
      "::"
    );
  }
}
