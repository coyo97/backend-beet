import type {
  RecentResult,
  RecentTeamMatch,
} from "../../domain/entities/MatchContext";

interface LowerLeagueArchiveTeam {
  id:
    string;

  name:
    string;
}

interface CacheEntry {
  expiresAt:
    number;

  matches:
    RecentTeamMatch[];
}

export class LowerLeagueArchiveRecentFormClient {
  private readonly baseUrl =
    "https://lowerleaguearchive.com";

  private readonly cache =
    new Map<
      string,
      CacheEntry
    >();

  constructor(
    private readonly cacheMs =
      5 * 60 * 1000
  ) {}

  public async getRecentMatches(
    team:
      LowerLeagueArchiveTeam
  ): Promise<
    RecentTeamMatch[]
  > {

    const cached =
      this.cache.get(
        team.id
      );

    if (
      cached &&
      cached.expiresAt >
        Date.now()
    ) {
      return cached.matches;
    }

    const url =
      `${this.baseUrl}/en/clubs/${team.id}/`;

    const html =
      await this.fetchHtml(
        url
      );

    const matches =
      this.extractRecentMatches(
        html
      )
        .slice(
          0,
          5
        );

    this.cache.set(
      team.id,
      {
        expiresAt:
          Date.now() +
          this.cacheMs,

        matches,
      }
    );

    return matches;
  }

  private extractRecentMatches(
    html:
      string
  ): RecentTeamMatch[] {

    const matches:
      RecentTeamMatch[] =
      [];

    /*
     * Ejemplo real:
     *
     * <a
     *   href="/en/matches/244/"
     *   class="fs-cell fs-L ..."
     *   title="Lost 1–2 vs Wuhan Lianzhen (H)"
     * >
     */
    const anchorRegex =
      /<a\b([^>]*\bhref="\/en\/matches\/\d+\/"[^>]*)>/gi;

    let anchorMatch:
      RegExpExecArray |
      null;

    while (
      (
        anchorMatch =
          anchorRegex.exec(
            html
          )
      ) !==
      null
    ) {

      const attributes =
        anchorMatch[1];

      const href =
        attributes.match(
          /\bhref="([^"]+)"/i
        )?.[1];

      const className =
        attributes.match(
          /\bclass="([^"]+)"/i
        )?.[1];

      const rawTitle =
        attributes.match(
          /\btitle="([^"]+)"/i
        )?.[1];

      if (
        !href ||
        !className ||
        !rawTitle
      ) {
        continue;
      }

      const matchId =
        href.match(
          /\/matches\/(\d+)\/?/
        )?.[1];

      const classResult =
        className.match(
          /\bfs-([WDL])\b/i
        )?.[1]
          ?.toUpperCase();

      if (
        !matchId ||
        (
          classResult !==
            "W" &&
          classResult !==
            "D" &&
          classResult !==
            "L"
        )
      ) {
        continue;
      }

      const title =
        this.decodeHtml(
          rawTitle
        );

      const parsed =
        title.match(
          /^(?:Won|Drew|Lost)\s+(\d+)\s*[–-]\s*(\d+)\s+vs\s+(.+?)\s+\(([HA])\)$/i
        );

      if (!parsed) {
        continue;
      }

      const goalsFor =
        Number(
          parsed[1]
        );

      const goalsAgainst =
        Number(
          parsed[2]
        );

      const opponentName =
        parsed[3]
          .trim();

      const venue =
        parsed[4]
          .toUpperCase();

      matches.push({
        id:
          matchId,

        result:
          classResult as
            RecentResult,

        opponentName,

        /*
         * LowerLeagueArchive no nos
         * proporciona aquí la posición
         * del rival.
         */
        opponentPosition:
          null,

        homeAway:
          venue ===
            "H"
            ? "home"
            : "away",

        goalsFor,

        goalsAgainst,

        /*
         * Primera integración:
         * la celda de recent form no
         * lleva fecha directamente.
         */
        playedAt:
          null,
      });

      /*
       * La página contiene exactamente
       * las celdas de recent form primero.
       * No necesitamos recorrer todo el
       * historial.
       */
      if (
        matches.length >=
        5
      ) {
        break;
      }
    }

    return matches;
  }

  private decodeHtml(
    value:
      string
  ): string {

    return value
      .replace(
        /&amp;/g,
        "&"
      )
      .replace(
        /&quot;/g,
        "\""
      )
      .replace(
        /&#39;/g,
        "'"
      )
      .replace(
        /&#x27;/gi,
        "'"
      )
      .replace(
        /&ndash;/g,
        "–"
      )
      .replace(
        /&nbsp;/g,
        " "
      )
      .trim();
  }

  private async fetchHtml(
    url:
      string
  ): Promise<string> {

    const response =
      await fetch(
        url,
        {
          headers: {
            "user-agent":
              "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/146 Safari/537.36",

            accept:
              "text/html,application/xhtml+xml",

            "accept-language":
              "en-US,en;q=0.9",
          },

          signal:
            AbortSignal.timeout(
              15_000
            ),
        }
      );

    if (!response.ok) {
      throw new Error(
        `LowerLeagueArchive HTTP ${response.status}: ${url}`
      );
    }

    return response.text();
  }
}
