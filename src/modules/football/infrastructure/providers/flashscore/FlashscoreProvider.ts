import type {
  LiveMatch,
} from "../../../domain/entities/LiveMatch";

import type {
  FootballProvider,
} from "../../../domain/providers/FootballProvider";

import {
  FlashscoreLiveMatchMapper,
} from "../../mappers/FlashscoreLiveMatchMapper";

import {
  FlashscoreClient,
} from "./FlashscoreClient";

import type {
  FlashscoreCompetition,
  FlashscoreMatch,
  FlashscoreMatchesResponse,
} from "./FlashscoreTypes";

interface MatchEntry {
  match: FlashscoreMatch;

  competition?:
    FlashscoreCompetition;
}

export class FlashscoreProvider
  implements FootballProvider
{
  constructor(
    private readonly client:
      FlashscoreClient =
        new FlashscoreClient()
  ) {}

  public async getLiveMatches():
    Promise<LiveMatch[]> {

    const data =
      await this.client.get<
        FlashscoreMatchesResponse
      >(
        "/matches/live",
        {
          sport:
            "football",
        }
      );

    const entries =
      this.extractMatches(
        data
      );

    return entries.map(
      ({
        match,
        competition,
      }) =>
        FlashscoreLiveMatchMapper
          .toDomain(
            match,
            competition
          )
    );
  }

  private extractMatches(
    data:
      FlashscoreMatchesResponse
  ): MatchEntry[] {

    const result:
      MatchEntry[] = [];

    for (
      const group
      of data.competitions ?? []
    ) {
      for (
        const match
        of group.matches ?? []
      ) {
        result.push({
          match,

          competition:
            group.competition,
        });
      }
    }

    for (
      const match
      of data.matches ?? []
    ) {
      result.push({
        match,

        competition:
          match.competition,
      });
    }

    return result;
  }
}
