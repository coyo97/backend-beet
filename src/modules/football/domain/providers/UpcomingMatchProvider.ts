
import type {
  LiveMatch,
} from "../entities/LiveMatch";

export interface UpcomingMatchProvider {
  getUpcomingMatches(): Promise<LiveMatch[]>;
}

