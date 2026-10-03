import type {
  RadarSignalPublisher,
} from "../../../radar/application/ports/RadarSignalPublisher";

import type {
  RedCardPressureSignal,
} from "../../../radar/domain/entities/RedCardPressureSignal";

import type {
  SocketServer,
} from "../../../../shared/infrastructure/socket/SocketServer";

import type {
  WatchlistSignalMatcher,
} from "../../application/services/WatchlistSignalMatcher";

import {
  WATCHLIST_SOCKET_EVENTS,
} from "./WatchlistSocketEvents";

export class WatchlistRadarSignalPublisher
  implements RadarSignalPublisher
{
  constructor(
    private readonly matcher:
      WatchlistSignalMatcher,

    private readonly socketServer:
      SocketServer
  ) {}

  public async publish(
    signal:
      RedCardPressureSignal
  ): Promise<void> {

    const matches =
      await this.matcher
        .execute(
          signal
        );

    for (
      const match
      of matches
    ) {
      this.socketServer.emit(
        WATCHLIST_SOCKET_EVENTS
          .ALERT,

        {
          emittedAt:
            new Date()
              .toISOString(),

          matchedBy:
            match.matchedBy,

          watchlistItem:
            match.item,

          signal,
        }
      );

      console.log(
        "[WatchlistAlert]",
        match.matchedBy,
        match.item.label,
        signal.match
          .home.name,
        "vs",
        signal.match
          .away.name
      );
    }
  }
}
