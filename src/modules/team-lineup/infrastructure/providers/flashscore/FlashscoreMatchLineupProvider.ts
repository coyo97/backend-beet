import type {
  MatchLineupProvider,
} from "../../../application/ports/MatchLineupProvider";

import type {
  MatchLineupPlayer,
  MatchLineupSnapshot,
  MatchLineupTeam,
} from "../../../domain/entities/MatchLineupSnapshot";

interface RawPlayerRef {
  id?:
    string | null;

  name?:
    string | null;
}

interface RawTeamRef {
  id?:
    string | null;

  name?:
    string | null;

  side?:
    string | null;
}

interface RawPlayerEntry {
  player?:
    RawPlayerRef | null;

  team?:
    RawTeamRef | null;

  side?:
    string | null;

  position?:
    string | null;

  is_goalkeeper?:
    boolean;

  is_starter?:
    boolean;
}

interface RawPlayerStatisticsResponse {
  id?:
    string | null;

  start_time?:
    string | null;

  players?:
    RawPlayerEntry[];
}

export class FlashscoreMatchLineupProvider
  implements MatchLineupProvider
{
  private readonly baseUrl:
    string;

  constructor(
    baseUrl =
      process.env
        .FLASHSCORE_BASE_URL ??
      "http://127.0.0.1:8100"
  ) {

    this.baseUrl =
      baseUrl.replace(
        /\/+$/,
        ""
      );
  }

  public supports(
    provider:
      string
  ): boolean {

    return provider ===
      "flashscore";
  }

  public async getLineup(
    provider:
      string,

    externalId:
      string
  ): Promise<
    MatchLineupSnapshot
  > {

    if (
      !this.supports(
        provider
      )
    ) {
      throw new Error(
        `Unsupported lineup provider: ${provider}`
      );
    }

    const response =
      await fetch(
        this.url(
          externalId
        )
      );

    if (
      !response.ok
    ) {
      throw new Error(
        `Flashscore player-statistics HTTP ${response.status}`
      );
    }

    const data =
      await response.json() as
        RawPlayerStatisticsResponse;

    const players =
      Array.isArray(
        data.players
      )
        ? data.players
        : [];

    const home =
      this.buildTeam(
        players,
        "home"
      );

    const away =
      this.buildTeam(
        players,
        "away"
      );

    const confirmed =
      home.starters.length ===
        11 &&
      away.starters.length ===
        11;

    const partial =
      home.starters.length >
        0 ||
      away.starters.length >
        0;

    return {
      provider:
        "flashscore",

      externalId,

      sourceKey:
        `flashscore:${externalId}`,

      kickoffAt:
        typeof data.start_time ===
          "string"
          ? data.start_time
          : null,

      status:
        confirmed
          ? "confirmed"
          : partial
            ? "partial"
            : "unavailable",

      home,

      away,

      fetchedAt:
        new Date()
          .toISOString(),
    };
  }

  private buildTeam(
    players:
      RawPlayerEntry[],

    side:
      "home" |
      "away"
  ): MatchLineupTeam {

    const teamPlayers =
      players.filter(
        player =>
          this.sideOf(
            player
          ) ===
          side
      );

    const firstWithTeam =
      teamPlayers.find(
        player =>
          player.team
      );

    const team =
      firstWithTeam
        ?.team ??
      null;

    const starters =
      teamPlayers
        .filter(
          player =>
            player.is_starter ===
            true
        )
        .map(
          player =>
            this.toPlayer(
              player
            )
        )
        .filter(
          (
            player
          ): player is MatchLineupPlayer =>
            player !==
            null
        );

    const substitutes =
      teamPlayers
        .filter(
          player =>
            player.is_starter !==
            true
        )
        .map(
          player =>
            this.toPlayer(
              player
            )
        )
        .filter(
          (
            player
          ): player is MatchLineupPlayer =>
            player !==
            null
        );

    return {
      teamId:
        typeof team?.id ===
          "string"
          ? team.id
          : null,

      teamName:
        typeof team?.name ===
          "string"
          ? team.name
          : side ===
              "home"
            ? "Home"
            : "Away",

      starters,

      substitutes,
    };
  }

  private sideOf(
    player:
      RawPlayerEntry
  ):
    "home" |
    "away" |
    null {

    const raw =
      (
        player.side ??
        player.team?.side ??
        ""
      )
        .trim()
        .toLowerCase();

    if (
      raw ===
      "home"
    ) {
      return "home";
    }

    if (
      raw ===
      "away"
    ) {
      return "away";
    }

    return null;
  }

  private toPlayer(
    entry:
      RawPlayerEntry
  ):
    MatchLineupPlayer |
    null {

    const name =
      typeof entry
        .player
        ?.name ===
        "string"
        ? entry.player
            .name
            .trim()
        : "";

    if (!name) {
      return null;
    }

    return {
      playerId:
        typeof entry
          .player
          ?.id ===
          "string"
          ? entry.player.id
          : null,

      name,

      position:
        typeof entry
          .position ===
          "string"
          ? entry.position
          : null,

      isGoalkeeper:
        entry
          .is_goalkeeper ===
        true,
    };
  }

  private url(
    externalId:
      string
  ): string {

    const params =
      new URLSearchParams({
        match:
          externalId,
      });

    return (
      `${this.baseUrl}` +
      "/matches/player-statistics?" +
      params.toString()
    );
  }
}
