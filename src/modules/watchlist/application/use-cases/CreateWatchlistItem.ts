import type {
  CreateWatchlistItemInput,
  WatchlistItem,
} from "../../domain/entities/WatchlistItem";

import type {
  WatchlistRepository,
} from "../../domain/repositories/WatchlistRepository";

export class CreateWatchlistItem {
  constructor(
    private readonly repository:
      WatchlistRepository
  ) {}

  public async execute(
    input:
      CreateWatchlistItemInput
  ): Promise<
    WatchlistItem
  > {

    const dedupKey =
      this.buildDedupKey(
        input
      );

    const existing =
      await this.repository
        .findByDedupKey(
          dedupKey
        );

    /*
     * POST idempotente:
     * seguir dos veces lo mismo
     * devuelve el mismo elemento.
     */
    if (existing) {
      if (
        !existing.enabled
      ) {
        const enabled =
          await this.repository
            .setEnabled(
              existing.id,
              true
            );

        return (
          enabled ??
          existing
        );
      }

      return existing;
    }

    return this.repository
      .create({
        type:
          input.type,

        label:
          input.label.trim(),

        dedupKey,

        enabled:
          true,

        target:
          input.target,

        rule:
          input.rule ??
          null,
      });
  }

  private buildDedupKey(
    input:
      CreateWatchlistItemInput
  ): string {

    switch (
      input.type
    ) {
      case "match": {
        const provider =
          input.target
            .provider;

        const externalId =
          input.target
            .externalId;

        if (
          !provider ||
          !externalId
        ) {
          throw new Error(
            "Match watchlist requires provider and externalId"
          );
        }

        return [
          "match",
          provider,
          externalId,
        ].join(":");
      }

      case "team": {
        const identity =
          input.target
            .externalId ??
          input.target
            .name;

        if (!identity) {
          throw new Error(
            "Team watchlist requires externalId or name"
          );
        }

        return [
          "team",
          input.target
            .provider ??
            "generic",
          this.normalize(
            identity
          ),
        ].join(":");
      }

      case "competition": {
        const name =
          input.target
            .competition ??
          input.target
            .name;

        if (!name) {
          throw new Error(
            "Competition watchlist requires competition name"
          );
        }

        return [
          "competition",
          this.normalize(
            input.target
              .country ??
              "unknown"
          ),
          this.normalize(
            name
          ),
        ].join(":");
      }

      case "country": {
        const country =
          input.target
            .country ??
          input.target
            .name;

        if (!country) {
          throw new Error(
            "Country watchlist requires country"
          );
        }

        return [
          "country",
          this.normalize(
            country
          ),
        ].join(":");
      }

      case "radar-rule": {
        if (!input.rule) {
          throw new Error(
            "Radar rule watchlist requires rule"
          );
        }

        return [
          "radar-rule",
          input.rule.event,
          this.normalize(
            input.rule
              .country ??
              "*"
          ),
          this.normalize(
            input.rule
              .teamName ??
              "*"
          ),
          input.rule
            .minimumStrength ??
            "clear",
        ].join(":");
      }
    }
  }

  private normalize(
    value: string
  ): string {

    return value
      .normalize(
        "NFD"
      )
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .trim()
      .toLowerCase()
      .replace(
        /\s+/g,
        "-"
      );
  }
}
