import type {
  LiveMatch,
} from "../../domain/entities/LiveMatch";

import type {
  RecentMatch,
} from "../../domain/entities/RecentMatch";

export interface ListRecentMatchesInput {
  since:
    Date;

  limit:
    number;
}

export interface RecentMatchStore {
  observe(
    matches:
      LiveMatch[]
  ): Promise<void>;

  listRecent(
    input:
      ListRecentMatchesInput
  ): Promise<
    RecentMatch[]
  >;
}
