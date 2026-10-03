export type MatchSide =
  | "home"
  | "away"
  | null;

export interface MatchIncident {
  id: string | null;

  side: MatchSide;

  minute: string | null;
  minuteNumber: number | null;

  type: string | null;
  reason: string | null;
  description: string | null;

  player: {
    id: string | null;
    name: string | null;
  } | null;

  homeScore: number | null;
  awayScore: number | null;
}
