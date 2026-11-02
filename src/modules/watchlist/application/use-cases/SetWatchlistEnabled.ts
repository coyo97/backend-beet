
import type {
  WatchlistItem,
} from "../../domain/entities/WatchlistItem";

import type {
  WatchlistRepository,
} from "../../domain/repositories/WatchlistRepository";

export class SetWatchlistEnabled {
  constructor(
    private readonly repository:
      WatchlistRepository
  ) {}

  public async execute(
    id: string,
    enabled: boolean,
    ownerId: string
  ): Promise<WatchlistItem | null> {

    return this.repository
      .setEnabled(
        id,
        enabled,
        ownerId
      );
  }
}

