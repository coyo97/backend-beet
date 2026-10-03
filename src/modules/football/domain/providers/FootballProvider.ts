import type {
  LiveMatch,
} from "../entities/LiveMatch";

export interface FootballProvider {
  getLiveMatches(): Promise<LiveMatch[]>;
}
