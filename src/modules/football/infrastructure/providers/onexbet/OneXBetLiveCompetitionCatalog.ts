
import type {
  LiveMatch,
} from "../../../domain/entities/LiveMatch";

import {
  OneXBetLiveClient,
} from "./OneXBetLiveClient";

import {
  OneXBetLiveHtmlParser,
} from "./OneXBetLiveHtmlParser";

import {
  OneXBetLiveProvider,
} from "./OneXBetLiveProvider";

export interface OneXBetCompetitionCatalogResult {
  matches: LiveMatch[];
  succeeded: number;
  failed: string[];
}

export class OneXBetLiveCompetitionCatalog {
  private readonly providers =
    new Map<string, OneXBetLiveProvider>();

  private readonly cacheMs = 60_000;

  private readonly baseUrl =
    "https://bol.1xbet.com/es/live/football";

  constructor(
    private readonly slugs: readonly string[]
  ) {}

  private getProvider(
    slug: string
  ): OneXBetLiveProvider {
    const existing = this.providers.get(slug);

    if (existing) {
      return existing;
    }

    if (!/^\d+-[a-z0-9-]+$/.test(slug)) {
      throw new Error(
        `Invalid 1xBet competition: ${slug}`
      );
    }

    const client = new OneXBetLiveClient(
      `${this.baseUrl}/${slug}`,
      this.cacheMs
    );

    const provider = new OneXBetLiveProvider(
      client,
      new OneXBetLiveHtmlParser()
    );

    this.providers.set(slug, provider);

    return provider;
  }

  public async getAll():
    Promise<OneXBetCompetitionCatalogResult> {

    const slugs = [...new Set(this.slugs)];

    const unique = new Map<string, LiveMatch>();

    const failed: string[] = [];

    let succeeded = 0;

    /*
     * Nunca más de dos páginas
     * de competición simultáneamente.
     */
    for (
      let index = 0;
      index < slugs.length;
      index += 2
    ) {
      const batch = slugs.slice(
        index,
        index + 2
      );

      const results = await Promise.allSettled(
        batch.map(slug =>
          this.getProvider(slug)
            .getLiveMatches()
        )
      );

      for (
        let i = 0;
        i < results.length;
        i++
      ) {
        const slug = batch[i];
        const result = results[i];

        if (result.status === "rejected") {
          failed.push(slug);

          console.warn(
            "[OneXBetCompetitionCatalog]",
            slug,
            result.reason
          );

          continue;
        }

        succeeded++;

        const expectedChampId =
          slug.split("-")[0];

        for (const match of result.value) {
          /*
           * Conservar únicamente partidos
           * de la competición solicitada.
           */
          if (
            String(match.competition.id) !==
            expectedChampId
          ) {
            continue;
          }

          /*
           * Excluir registros agregados
           * con listas de muchos equipos.
           */
          const combinedNames =
            [match.home.name, match.away.name]
              .some(name =>
                (name.match(/\//g) ?? []).length >= 2
              );

          if (combinedNames) {
            continue;
          }

          const source = match.sources.find(
            item => item.provider === "bookmaker"
          );

          if (!source?.externalId) {
            continue;
          }

          unique.set(
            String(source.externalId),
            match
          );
        }
      }
    }

    return {
      matches: [...unique.values()],
      succeeded,
      failed,
    };
  }
}

