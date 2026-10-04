import type {
  LiveMatch,
} from "./LiveMatch";

export interface RecentMatch {
  match:
    LiveMatch;

  lastSeenAt:
    string;

  endedAt:
    string;

  resultConfirmed:
    boolean;
}
