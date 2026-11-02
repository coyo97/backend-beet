
import type {
  WatchlistRepository,
} from "../../domain/repositories/WatchlistRepository";

export class DeleteWatchlistItem {
  constructor(
    private readonly repository:
      WatchlistRepository
  ) {}

  public async execute(
    id: string,
    ownerId: string
  ): Promise<boolean> {

    return this.repository
      .deleteById(
        id,
        ownerId
      );
  }
}

