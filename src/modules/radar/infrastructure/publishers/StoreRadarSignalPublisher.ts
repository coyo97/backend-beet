import type {
  RadarSignalPublisher,
} from "../../application/ports/RadarSignalPublisher";

import type {
  RadarSignalStore,
} from "../../application/ports/RadarSignalStore";

import type {
  RedCardPressureSignal,
} from "../../domain/entities/RedCardPressureSignal";

export class StoreRadarSignalPublisher
  implements RadarSignalPublisher
{
  constructor(
    private readonly store:
      RadarSignalStore
  ) {}

  public async publish(
    signal:
      RedCardPressureSignal
  ): Promise<void> {

    await this.store.save(
      signal
    );
  }
}
