export interface HistoricalTeamMatch {
  provider:
    string;

  externalId:
    string;

  sourceKey:
    string;

  kickoffAt:
    string | null;

  homeTeamId:
    string | null;

  awayTeamId:
    string | null;
}

export interface ListRecentTeamMatchesInput {
  provider:
    string;

  teamId:
    string;

  limit?:
    number;

  excludeSourceKey?:
    string;
}

export interface TeamMatchHistoryCatalog {
  listRecentFinished(
    input:
      ListRecentTeamMatchesInput
  ): Promise<
    HistoricalTeamMatch[]
  >;
}
