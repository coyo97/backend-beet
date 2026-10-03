import type {
  RadarSignalPublisher,
} from "../../application/ports/RadarSignalPublisher";

import type {
  RedCardPressureSignal,
} from "../../domain/entities/RedCardPressureSignal";

export class CompositeRadarSignalPublisher
  implements RadarSignalPublisher
{
  constructor(
    private readonly publishers:
      RadarSignalPublisher[]
  ) {}

  public async publish(
    signal:
      RedCardPressureSignal
  ): Promise<void> {

    const results =
      await Promise.allSettled(
        this.publishers.map(
          (publisher) =>
            publisher.publish(
              signal
            )
        )
      );

    for (
      const result
      of results
    ) {
      if (
        result.status ===
        "rejected"
      ) {
        console.error(
          "[CompositeRadarSignalPublisher]",
          result.reason
        );
      }
    }
  }
}
