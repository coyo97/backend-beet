import type {
  RedCardPressureSignal,
} from "../../../radar/domain/entities/RedCardPressureSignal";

import type {
  WatchlistItem,
} from "../../domain/entities/WatchlistItem";

import type {
  WatchlistRepository,
} from "../../domain/repositories/WatchlistRepository";

export type WatchlistMatchReason =
  | "match"
  | "team"
  | "competition"
  | "country"
  | "radar-rule";

export interface WatchlistSignalMatch {
  item:
    WatchlistItem;

  matchedBy:
    WatchlistMatchReason;
}

export class WatchlistSignalMatcher {
  constructor(
    private readonly repository:
      WatchlistRepository
  ) {}

  public async execute(
    signal:
      RedCardPressureSignal
  ): Promise<
    WatchlistSignalMatch[]
  > {

    const items =
      await this.repository
        .findAll();

    const result:
      WatchlistSignalMatch[] =
        [];

    for (
      const item
      of items
    ) {
      if (
        !item.enabled
      ) {
        continue;
      }

      if (
        this.matches(
          item,
          signal
        )
      ) {
        result.push({
          item,

          matchedBy:
            item.type,
        });
      }
    }

    return result;
  }

private matches(
  item:
    WatchlistItem,

  signal:
    RedCardPressureSignal
): boolean {

  switch (
    item.type
  ) {
    case "match":
      return this
        .matchesMatch(
          item,
          signal
        );

    case "team":
      return this
        .matchesTeam(
          item,
          signal
        );

    case "competition":
      return this
        .matchesCompetition(
          item,
          signal
        );

    case "country":
      return this
        .matchesCountry(
          item,
          signal
        );

    case "radar-rule":
      return this
        .matchesRule(
          item,
          signal
        );
  }

  return false;
}

  private matchesMatch(
    item:
      WatchlistItem,

    signal:
      RedCardPressureSignal
  ): boolean {

    const provider =
      item.target.provider;

    const externalId =
      item.target.externalId;

    if (
      !provider ||
      !externalId
    ) {
      return false;
    }

    return signal
      .match
      .sources
      .some(
        (
          source
        ) =>
          source.provider ===
            provider &&
          source.externalId ===
            externalId
      );
  }

  private matchesTeam(
    item:
      WatchlistItem,

    signal:
      RedCardPressureSignal
  ): boolean {

    const name =
      item.target.name;

    if (!name) {
      return false;
    }

    const target =
      this.normalize(
        name
      );

    return (
      this.normalize(
        signal.match
          .home.name
      ) === target ||
      this.normalize(
        signal.match
          .away.name
      ) === target
    );
  }

  private matchesCompetition(
    item:
      WatchlistItem,

    signal:
      RedCardPressureSignal
  ): boolean {

    const competition =
      item.target
        .competition ??
      item.target.name;

    if (!competition) {
      return false;
    }

    if (
      this.normalize(
        competition
      ) !==
      this.normalize(
        signal.match
          .competition
          .name
      )
    ) {
      return false;
    }

    if (
      item.target.country
    ) {
      return (
        this.normalize(
          item.target.country
        ) ===
        this.normalize(
          signal.match
            .competition
            .country
        )
      );
    }

    return true;
  }

  private matchesCountry(
    item:
      WatchlistItem,

    signal:
      RedCardPressureSignal
  ): boolean {

    const country =
      item.target.country ??
      item.target.name;

    if (!country) {
      return false;
    }

    return (
      this.normalize(
        country
      ) ===
      this.normalize(
        signal.match
          .competition
          .country
      )
    );
  }

private matchesRule(
  item:
    WatchlistItem,

  signal:
    RedCardPressureSignal
): boolean {

  const rule =
    item.rule;

  if (
    !rule ||
    rule.event !==
      "RED_CARD_PRESSURE"
  ) {
    return false;
  }

  const match =
    signal.match;

  if (
    rule.country &&
    this.normalize(
      rule.country
    ) !==
      this.normalize(
        match.competition
          .country
      )
  ) {
    return false;
  }

  if (
    rule.competition &&
    this.normalize(
      rule.competition
    ) !==
      this.normalize(
        match.competition
          .name
      )
  ) {
    return false;
  }

  let matchedTeamSide:
    "home" |
    "away" |
    null =
      null;

  if (
    rule.teamName
  ) {
    const target =
      this.normalize(
        rule.teamName
      );

    if (
      this.normalize(
        match.home.name
      ) ===
      target
    ) {
      matchedTeamSide =
        "home";
    } else if (
      this.normalize(
        match.away.name
      ) ===
      target
    ) {
      matchedTeamSide =
        "away";
    } else {
      return false;
    }
  }

  if (
    rule.teamMustHaveAdvantage &&
    matchedTeamSide &&
    signal.advantagedSide !==
      matchedTeamSide
  ) {
    return false;
  }

  if (
    rule.minimumStrength
  ) {
    const current =
      this.strengthRank(
        signal.strength
      );

    const required =
      this.strengthRank(
        rule.minimumStrength
      );

    if (
      current <
      required
    ) {
      return false;
    }
  }

  const minute =
    match.status.minute;

  if (
    rule.minimumMinute !==
      undefined &&
    (
      minute ===
        null ||
      minute <
        rule.minimumMinute
    )
  ) {
    return false;
  }

  if (
    rule.maximumMinute !==
      undefined &&
    (
      minute ===
        null ||
      minute >
        rule.maximumMinute
    )
  ) {
    return false;
  }

  if (
    rule.minimumPressureScore !==
      undefined
  ) {

    const pressureScore =
      signal.advantagedSide ===
        "home"
        ? signal.pressure
            .homeScore
        : signal.advantagedSide ===
            "away"
          ? signal.pressure
              .awayScore
          : Math.max(
              signal.pressure
                .homeScore,
              signal.pressure
                .awayScore
            );

    if (
      pressureScore <
      rule.minimumPressureScore
    ) {
      return false;
    }
  }

  return true;
}

  private strengthRank(
    value:
      "clear" |
      "strong"
  ): number {

    return value ===
      "strong"
      ? 2
      : 1;
  }

  private normalize(
    value: string
  ): string {

    return value
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .trim()
      .toLowerCase()
      .replace(
        /\s+/g,
        " "
      );
  }
}
