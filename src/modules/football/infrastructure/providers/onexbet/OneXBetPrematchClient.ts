import {
  OneXBetPrematchHtmlParser,
  type OneXBetPrematchGame,
} from "./OneXBetPrematchHtmlParser";

export interface OneXBetPrematchSnapshot {
  competitionSlug: string;
  fetchedAt: string;
  stale: boolean;
  games: OneXBetPrematchGame[];
}

interface CacheEntry {
  fetchedAt: string;
  timestamp: number;
  games: OneXBetPrematchGame[];
}

export class OneXBetPrematchClient {
  private readonly parser =
    new OneXBetPrematchHtmlParser();

  private readonly cache =
    new Map<string, CacheEntry>();

  private readonly inFlight =
    new Map<
      string,
      Promise<OneXBetPrematchSnapshot>
    >();

  private readonly cacheMs =
    5 * 60 * 1000;

  private readonly staleMs =
    30 * 60 * 1000;

  private readonly baseUrl: URL;

  constructor() {
    this.baseUrl = new URL(
      process.env.ONEXBET_PREMATCH_URL ??
        "https://bol.1xbet.com/es/line/football"
    );

    this.validateBaseUrl(this.baseUrl);
  }

  public async getCompetition(
    competitionSlug: string
  ): Promise<OneXBetPrematchSnapshot> {
    this.validateSlug(competitionSlug);

    const cached =
      this.cache.get(competitionSlug);

    const now = Date.now();

    if (
      cached &&
      now - cached.timestamp < this.cacheMs
    ) {
      return this.toSnapshot(
        competitionSlug,
        cached,
        false
      );
    }

    const pending =
      this.inFlight.get(competitionSlug);

    if (pending) {
      return pending;
    }

    const request = this.fetchCompetition(
      competitionSlug
    )
      .catch(error => {
        const previous =
          this.cache.get(competitionSlug);

        if (
          previous &&
          Date.now() - previous.timestamp <
            this.staleMs
        ) {
          console.warn(
            "[OneXBetPrematch] Using stale cache:",
            competitionSlug
          );

          return this.toSnapshot(
            competitionSlug,
            previous,
            true
          );
        }

        throw error;
      })
      .finally(() => {
        this.inFlight.delete(
          competitionSlug
        );
      });

    this.inFlight.set(
      competitionSlug,
      request
    );

    return request;
  }

  private async fetchCompetition(
    competitionSlug: string
  ): Promise<OneXBetPrematchSnapshot> {
    const url =
      this.buildCompetitionUrl(
        competitionSlug
      );

    const response = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/146 Safari/537.36",

        accept: "text/html",

        "accept-language":
          "en-US,en;q=0.9",
      },

      signal:
        AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      throw new Error(
        `[OneXBetPrematch] HTTP ${response.status}`
      );
    }

    const finalUrl =
      new URL(response.url);

    this.validateBaseHost(finalUrl);

    const html =
      await response.text();

    if (
      !html.includes(
        "dashboardStore-games"
      )
    ) {
      throw new Error(
        "[OneXBetPrematch] Missing games store"
      );
    }

    const games = this.parser
      .parse(html)
      .filter(
        game =>
          game.champNameForUrl ===
          competitionSlug
      );

    const fetchedAt =
      new Date().toISOString();

    const entry: CacheEntry = {
      fetchedAt,
      timestamp: Date.now(),
      games,
    };

    this.cache.set(
      competitionSlug,
      entry
    );

    return this.toSnapshot(
      competitionSlug,
      entry,
      false
    );
  }

  public buildCompetitionUrl(
    competitionSlug: string
  ): string {
    this.validateSlug(competitionSlug);

    const basePath =
      this.baseUrl.pathname.replace(
        /\/+$/,
        ""
      );

    return new URL(
      `${basePath}/${competitionSlug}`,
      this.baseUrl.origin
    ).toString();
  }

  public buildMatchUrl(
    game: OneXBetPrematchGame
  ): string | null {
    const competitionSlug =
      game.champNameForUrl;

    const gameSlug =
      game.gameNameForUrl;

    if (
      !competitionSlug ||
      !gameSlug
    ) {
      return null;
    }

    if (
      !/^\d+-[a-z0-9-]+$/.test(
        competitionSlug
      ) ||
      !/^\d+-[a-z0-9-]+$/.test(
        gameSlug
      )
    ) {
      return null;
    }

    return (
      this.buildCompetitionUrl(
        competitionSlug
      ) +
      "/" +
      gameSlug
    );
  }

  private toSnapshot(
    competitionSlug: string,
    entry: CacheEntry,
    stale: boolean
  ): OneXBetPrematchSnapshot {
    return {
      competitionSlug,
      fetchedAt: entry.fetchedAt,
      stale,
      games: [...entry.games],
    };
  }

  private validateSlug(
    slug: string
  ): void {
    if (
      !/^\d+-[a-z0-9-]+$/.test(slug)
    ) {
      throw new Error(
        "[OneXBetPrematch] Invalid competition slug"
      );
    }
  }

  private validateBaseHost(
    url: URL
  ): void {
    if (
      url.protocol !== "https:" ||
      !/^(?:[a-z0-9-]+\.)*1xbet\.com$/.test(
        url.hostname
      )
    ) {
      throw new Error(
        "[OneXBetPrematch] Invalid 1xBet host"
      );
    }
  }

  private validateBaseUrl(
    url: URL
  ): void {
    this.validateBaseHost(url);

    if (
  !/^\/(?:en|es)\/line\/football$/.test(
    url.pathname
  )
) {
      throw new Error(
        "[OneXBetPrematch] Invalid prematch base path"
      );
    }
  }
}
