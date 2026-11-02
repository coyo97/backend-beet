
import type {
  WatchlistItem,
} from "../../domain/entities/WatchlistItem";

import type {
  WatchlistRepository,
} from "../../domain/repositories/WatchlistRepository";

export class GetWatchlist {
  constructor(
    private readonly repository:
      WatchlistRepository
  ) {}

  public async execute(
    ownerId: string
  ): Promise<WatchlistItem[]> {

    return this.repository
      .findAll(ownerId);
  }
}

