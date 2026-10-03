import type {
  SupplementalRedCardDto,
} from "../dto/SupplementalRedCardDto";

import {
  GetSupplementalRedCards,
} from "./GetSupplementalRedCards";

type GetOriginalRedCards =
  () => Promise<
    unknown
  >;

interface JsonObject {
  [key: string]:
    unknown;
}

export interface UnifiedRedCardItem {
  key:
    string;

  providers:
    string[];

  original:
    unknown | null;

  supplemental:
    SupplementalRedCardDto | null;
}

export interface UnifiedRedCardsResult {
  originalCount:
    number;

  supplementalCount:
    number;

  mergedCount:
    number;

  items:
    UnifiedRedCardItem[];
}

export class GetUnifiedRedCards {
  constructor(
    private readonly getOriginalRedCards:
      GetOriginalRedCards,

    private readonly getSupplementalRedCards:
      GetSupplementalRedCards
  ) {}

  public async execute():
    Promise<
      UnifiedRedCardsResult
    > {

    /*
     * Las dos fuentes trabajan
     * independientemente.
     *
     * Si una falla, la otra
     * sigue funcionando.
     */
    const [
      originalResult,
      supplementalResult,
    ] =
      await Promise.allSettled([
        this.getOriginalRedCards(),

        this.getSupplementalRedCards
          .execute(),
      ]);

    const originalItems =
      originalResult.status ===
        "fulfilled"
        ? this.extractArray(
            originalResult.value
          )
        : [];

    const supplementalItems =
      supplementalResult.status ===
        "fulfilled"
        ? supplementalResult.value
        : [];

    const merged:
      UnifiedRedCardItem[] =
        [];

    /*
     * Índices para deduplicación.
     */
    const sourceIndex =
      new Map<
        string,
        UnifiedRedCardItem
      >();

    const fallbackIndex =
      new Map<
        string,
        UnifiedRedCardItem
      >();

    /*
     * Primero conservamos TODO
     * lo que ya daba el radar
     * original.
     */
    for (
      const original
      of originalItems
    ) {

      const providers =
        this.extractProviders(
          original
        );

      const item:
        UnifiedRedCardItem =
        {
          key:
            this.createOriginalKey(
              original
            ),

          providers,

          original,

          supplemental:
            null,
        };

      merged.push(
        item
      );

      for (
        const sourceKey
        of this.extractSourceKeys(
          original
        )
      ) {
        sourceIndex.set(
          sourceKey,
          item
        );
      }

      const fallback =
        this.createOriginalFallbackKey(
          original
        );

      if (fallback) {
        fallbackIndex.set(
          fallback,
          item
        );
      }
    }

    /*
     * Después agregamos 1xBet/FotMob.
     */
    for (
      const supplemental
      of supplementalItems
    ) {

      const sourceKeys =
        supplemental
          .match
          .sources
          .map(
            (
              source
            ) =>
              `${source.provider}:${source.externalId}`
          );

      let existing:
        UnifiedRedCardItem | undefined;

      /*
       * La forma más fiable:
       * mismo provider + externalId.
       */
      for (
        const sourceKey
        of sourceKeys
      ) {

        existing =
          sourceIndex.get(
            sourceKey
          );

        if (existing) {
          break;
        }
      }

      /*
       * Si Flashscore y 1xBet no
       * comparten ID, intentamos por
       * equipos + competición.
       */
      if (!existing) {

        const fallback =
          this.createSupplementalFallbackKey(
            supplemental
          );

        existing =
          fallbackIndex.get(
            fallback
          );
      }

      if (existing) {

        existing.supplemental =
          supplemental;

        existing.providers =
          Array.from(
            new Set([
              ...existing.providers,

              ...supplemental
                .detection
                .providers,
            ])
          );

        /*
         * Registramos todos los nuevos
         * IDs sobre el mismo item.
         */
        for (
          const sourceKey
          of sourceKeys
        ) {
          sourceIndex.set(
            sourceKey,
            existing
          );
        }

        continue;
      }

      const item:
        UnifiedRedCardItem =
        {
          key:
            this.createSupplementalKey(
              supplemental
            ),

          providers:
            supplemental
              .detection
              .providers,

          original:
            null,

          supplemental,
        };

      merged.push(
        item
      );

      for (
        const sourceKey
        of sourceKeys
      ) {
        sourceIndex.set(
          sourceKey,
          item
        );
      }

      fallbackIndex.set(
        this.createSupplementalFallbackKey(
          supplemental
        ),
        item
      );
    }

    return {
      originalCount:
        originalItems.length,

      supplementalCount:
        supplementalItems.length,

      mergedCount:
        merged.length,

      items:
        merged,
    };
  }

  private extractArray(
    value:
      unknown
  ): unknown[] {

    if (
      Array.isArray(
        value
      )
    ) {
      return value;
    }

    const object =
      this.asObject(
        value
      );

    const candidates = [
      object.matches,
      object.items,
      object.data,
      object.redCards,
    ];

    for (
      const candidate
      of candidates
    ) {

      if (
        Array.isArray(
          candidate
        )
      ) {
        return candidate;
      }
    }

    return [];
  }

  private extractSourceKeys(
    value:
      unknown
  ): string[] {

    const match =
      this.getMatchObject(
        value
      );

    if (
      !Array.isArray(
        match.sources
      )
    ) {
      return [];
    }

    const keys:
      string[] =
        [];

    for (
      const source
      of match.sources
    ) {

      const object =
        this.asObject(
          source
        );

      const provider =
        this.asString(
          object.provider
        );

      const externalId =
        this.asStringOrNumber(
          object.externalId
        );

      if (
        provider &&
        externalId
      ) {
        keys.push(
          `${provider}:${externalId}`
        );
      }
    }

    return keys;
  }

  private extractProviders(
    value:
      unknown
  ): string[] {

    return this
      .extractSourceKeys(
        value
      )
      .map(
        (
          key
        ) =>
          key.split(
            ":"
          )[0]
      );
  }

  private createOriginalKey(
    value:
      unknown
  ): string {

    const sourceKeys =
      this.extractSourceKeys(
        value
      );

    if (
      sourceKeys.length >
      0
    ) {
      return sourceKeys
        .sort()
        .join(
          "|"
        );
    }

    return (
      this.createOriginalFallbackKey(
        value
      ) ??
      `legacy:${Date.now()}:${Math.random()}`
    );
  }

  private createSupplementalKey(
    value:
      SupplementalRedCardDto
  ): string {

    const sources =
      value.match
        .sources
        .map(
          (
            source
          ) =>
            `${source.provider}:${source.externalId}`
        )
        .sort();

    if (
      sources.length >
      0
    ) {
      return sources.join(
        "|"
      );
    }

    return this
      .createSupplementalFallbackKey(
        value
      );
  }

  private createOriginalFallbackKey(
    value:
      unknown
  ): string | null {

    const match =
      this.getMatchObject(
        value
      );

    const home =
      this.extractTeamName(
        match.home,
        match.homeTeam
      );

    const away =
      this.extractTeamName(
        match.away,
        match.awayTeam
      );

    if (
      !home ||
      !away
    ) {
      return null;
    }

    const competitionObject =
      this.asObject(
        match.competition
      );

    const competition =
      this.asString(
        competitionObject.name
      ) ??
      this.asString(
        match.competitionName
      ) ??
      "";

    return [
      this.normalize(
        competition
      ),

      this.normalize(
        home
      ),

      this.normalize(
        away
      ),
    ].join(
      ":"
    );
  }

  private createSupplementalFallbackKey(
    value:
      SupplementalRedCardDto
  ): string {

    return [
      this.normalize(
        value.match
          .competition
          .name
      ),

      this.normalize(
        value.match
          .home
          .name
      ),

      this.normalize(
        value.match
          .away
          .name
      ),
    ].join(
      ":"
    );
  }

  private getMatchObject(
    value:
      unknown
  ): JsonObject {

    const object =
      this.asObject(
        value
      );

    const nested =
      this.asObject(
        object.match
      );

    if (
      Object.keys(
        nested
      ).length >
      0
    ) {
      return nested;
    }

    return object;
  }

  private extractTeamName(
    primary:
      unknown,

    secondary:
      unknown
  ): string | null {

    const first =
      this.asObject(
        primary
      );

    const second =
      this.asObject(
        secondary
      );

    return (
      this.asString(
        first.name
      ) ??
      this.asString(
        second.name
      ) ??
      this.asString(
        primary
      ) ??
      this.asString(
        secondary
      )
    );
  }

  private asObject(
    value:
      unknown
  ): JsonObject {

    if (
      value &&
      typeof value ===
        "object" &&
      !Array.isArray(
        value
      )
    ) {
      return value as
        JsonObject;
    }

    return {};
  }

  private asString(
    value:
      unknown
  ): string | null {

    return typeof value ===
      "string"
      ? value
      : null;
  }

  private asStringOrNumber(
    value:
      unknown
  ): string | null {

    if (
      typeof value ===
      "string"
    ) {
      return value;
    }

    if (
      typeof value ===
        "number" &&
      Number.isFinite(
        value
      )
    ) {
      return String(
        value
      );
    }

    return null;
  }

  private normalize(
    value:
      string
  ): string {

    return value
      .normalize(
        "NFD"
      )
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .toLowerCase()
      .replace(
        /\b(fc|cf|sc|afc|club)\b/g,
        " "
      )
      .replace(
        /[^a-z0-9]+/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }
}
