import type {
  WatchlistRepository,
} from "../../domain/repositories/WatchlistRepository";

export class DeleteWatchlistItem {
  constructor(
    private readonly repository:
      WatchlistRepository
  ) {}

  public execute(
    id: string
  ): Promise<boolean> {

    return this.repository
      .deleteById(
        id
      );
  }
}
