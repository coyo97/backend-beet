import type {
  RadarSignalStore,
  StoredRadarSignal,
} from "../../application/ports/RadarSignalStore";

import type {
  RedCardPressureSignal,
} from "../../domain/entities/RedCardPressureSignal";

export interface InMemoryRadarSignalStoreOptions {
  ttlMs: number;
  maxItems: number;
}

export class InMemoryRadarSignalStore
  implements RadarSignalStore
{
  private items:
    StoredRadarSignal[] = [];

  constructor(
    private readonly options:
      InMemoryRadarSignalStoreOptions
  ) {}

  public save(
    signal:
      RedCardPressureSignal
  ): void {

    this.cleanup();

    this.items.unshift({
      publishedAt:
        new Date()
          .toISOString(),

      signal,
    });

    if (
      this.items.length >
      this.options.maxItems
    ) {
      this.items =
        this.items.slice(
          0,
          this.options.maxItems
        );
    }
  }

  public listRecent(
    limit = 50
  ): StoredRadarSignal[] {

    this.cleanup();

    const safeLimit =
      Math.max(
        1,
        Math.min(
          limit,
          this.options.maxItems
        )
      );

    return this.items
      .slice(
        0,
        safeLimit
      );
  }

  private cleanup():
    void {

    const now =
      Date.now();

    this.items =
      this.items.filter(
        (item) => {

          const publishedAt =
            new Date(
              item.publishedAt
            ).getTime();

          return (
            now -
            publishedAt <=
            this.options.ttlMs
          );
        }
      );
  }
}
