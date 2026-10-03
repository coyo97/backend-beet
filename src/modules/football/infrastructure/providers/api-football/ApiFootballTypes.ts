export interface ApiFootballResponse<T> {
  get: string;

  parameters: Record<
    string,
    string
  >;

  errors:
    | Record<string, unknown>
    | unknown[];

  results: number;

  paging: {
    current: number;
    total: number;
  };

  response: T[];
}

export interface ApiFootballTeam {
  id: number;
  name: string;
  logo: string;
  winner: boolean | null;
}

export interface ApiFootballFixture {
  fixture: {
    id: number;
    date: string;
    timestamp: number;

    status: {
      long: string;
      short: string;
      elapsed: number | null;
    };
  };

  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round: string | null;
  };

  teams: {
    home: ApiFootballTeam;
    away: ApiFootballTeam;
  };

  goals: {
    home: number | null;
    away: number | null;
  };
}
