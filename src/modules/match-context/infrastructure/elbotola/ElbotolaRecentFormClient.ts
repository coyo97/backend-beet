import type {
  RecentResult,
  RecentTeamMatch,
} from "../../domain/entities/MatchContext";

interface RawLastFive {
  href:
    string;

  id:
    string;

  awayLogoUrl:
    string;

  homeLogoUrl:
    string;

  label:
    string;

  tone:
    string;
}

interface ElbotolaTeam {
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

export class ElbotolaRecentFormClient {
  private readonly baseUrl =
    "https://m.elbotola.com";

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
      ElbotolaTeam
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
      `${this.baseUrl}/en/analytics/team/${team.id}/`;

    const html =
      await this.fetchHtml(
        url
      );

    const lastFive =
      this.extractLastFive(
        html
      )
        .slice(
          0,
          5
        );

    /*
     * Las páginas de detalle nos dan
     * los nombres exactos de ambos
     * equipos.
     *
     * allSettled evita perder toda
     * la forma si falla uno de los
     * cinco detalles.
     */
    const results =
      await Promise.allSettled(
        lastFive.map(
          (
            item
          ) =>
            this.toRecentMatch(
              team,
              item
            )
        )
      );

    const matches =
      results
        .flatMap(
          (
            result
          ) => {

            if (
              result.status !==
                "fulfilled" ||
              !result.value
            ) {
              return [];
            }

            return [
              result.value,
            ];
          }
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

  private async toRecentMatch(
    team:
      ElbotolaTeam,

    item:
      RawLastFive
  ): Promise<
    RecentTeamMatch |
    null
  > {

    const homeId =
      this.extractTeamIdFromLogo(
        item.homeLogoUrl
      );

    const awayId =
      this.extractTeamIdFromLogo(
        item.awayLogoUrl
      );

    const isHome =
      homeId ===
      team.id;

    const isAway =
      awayId ===
      team.id;

    if (
      !isHome &&
      !isAway
    ) {
      return null;
    }

    const score =
      this.parseScore(
        item.label
      );

    if (!score) {
      return null;
    }

    const goalsFor =
      isHome
        ? score.home
        : score.away;

    const goalsAgainst =
      isHome
        ? score.away
        : score.home;

    const detailUrl =
      new URL(
        item.href,
        this.baseUrl
      )
        .toString();

    const detailHtml =
      await this.fetchHtml(
        detailUrl
      );

    const title =
      this.extractTitle(
        detailHtml
      );

    const names =
      this.namesFromTitle(
        title
      );

    const opponentName =
      isHome
        ? names?.away
        : names?.home;

    if (!opponentName) {
      return null;
    }

    return {
      id:
        item.id ??
        null,

      result:
        this.resultFromScore(
          goalsFor,
          goalsAgainst
        ),

      opponentName,

      /*
       * Elbotola no nos está dando
       * aquí la posición de tabla.
       * No la inventamos.
       */
      opponentPosition:
        null,

      homeAway:
        isHome
          ? "home"
          : "away",

      goalsFor,

      goalsAgainst,

      /*
       * Primera integración:
       * todavía no extraemos fecha
       * del detalle.
       */
      playedAt:
        null,
    };
  }

  private extractLastFive(
    html:
      string
  ): RawLastFive[] {

    /*
     * Next.js los incluye dentro de
     * self.__next_f.push() con JSON
     * escapado.
     */
    const normalized =
      html
        .replace(
          /\\"/g,
          '"'
        )
        .replace(
          /\\u002F/g,
          "/"
        );

    const match =
      normalized.match(
        /"lastFive":(\[[\s\S]*?\]),"lastFiveTitle"/
      );

    if (!match) {
      return [];
    }

    try {
      const parsed =
        JSON.parse(
          match[1]
        );

      return Array.isArray(
        parsed
      )
        ? parsed as RawLastFive[]
        : [];
    } catch {
      return [];
    }
  }

  private extractTeamIdFromLogo(
    value:
      string
  ): string | null {

    const match =
      value.match(
        /\/logos\/([A-Za-z0-9]+)\.(?:png|webp|jpg|jpeg)/i
      );

    return (
      match?.[1] ??
      null
    );
  }

  private parseScore(
    value:
      string
  ): {
    home:
      number;

    away:
      number;
  } | null {

    const match =
      value.match(
        /(\d+)\s*[-–]\s*(\d+)/
      );

    if (!match) {
      return null;
    }

    return {
      home:
        Number(
          match[1]
        ),

      away:
        Number(
          match[2]
        ),
    };
  }

  private resultFromScore(
    goalsFor:
      number,

    goalsAgainst:
      number
  ): RecentResult {

    if (
      goalsFor >
      goalsAgainst
    ) {
      return "W";
    }

    if (
      goalsFor <
      goalsAgainst
    ) {
      return "L";
    }

    return "D";
  }

  private extractTitle(
    html:
      string
  ): string | null {

    const match =
      html.match(
        /<title[^>]*>([\s\S]*?)<\/title>/i
      );

    if (!match) {
      return null;
    }

    return this.decodeHtml(
      match[1]
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }

  private namesFromTitle(
    title:
      string | null
  ): {
    home:
      string;

    away:
      string;
  } | null {

    if (!title) {
      return null;
    }

    /*
     * Ejemplo:
     *
     * Guangdong Chenxingjuli 1-2
     * Wuhan Lianzhen - Elbotola
     */
    const normalized =
      title
        .replace(
          /\s+-\s+Elbotola.*$/i,
          ""
        )
        .trim();

    const match =
      normalized.match(
        /^(.*?)\s+\d+\s*[-–]\s*\d+\s+(.*?)$/
      );

    if (!match) {
      return null;
    }

    const home =
      match[1]
        .trim();

    const away =
      match[2]
        .trim();

    if (
      !home ||
      !away
    ) {
      return null;
    }

    return {
      home,
      away,
    };
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
        '"'
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
        /&nbsp;/g,
        " "
      );
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
        `Elbotola ${url} HTTP ${response.status}`
      );
    }

    return response.text();
  }
}
