import type {
  RedCardDetectedPublisher,
} from "../../application/ports/RedCardDetectedPublisher";

import type {
  RedCardDetectedSignal,
} from "../../domain/entities/RedCardDetectedSignal";

export class ConsoleRedCardDetectedPublisher
  implements RedCardDetectedPublisher
{
  public async publish(
    signal:
      RedCardDetectedSignal
  ): Promise<void> {

    console.log(
      "[RED CARD DETECTED]",
      {
        match:
          `${signal.match.home.name} vs ${signal.match.away.name}`,

        competition:
          signal.match
            .competition
            .name,

        minute:
          signal.match
            .status
            .minute,

        score:
          `${signal.match.home.goals ?? "-"}-${signal.match.away.goals ?? "-"}`,

        redCards:
          signal.redCards,

        affectedSide:
          signal.affectedSide,

        providers:
          signal.providers,
      }
    );
  }
}
