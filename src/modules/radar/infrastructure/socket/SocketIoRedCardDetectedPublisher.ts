import type {
  RedCardDetectedPublisher,
} from "../../application/ports/RedCardDetectedPublisher";

import type {
  RedCardDetectedSignal,
} from "../../domain/entities/RedCardDetectedSignal";

import type {
  SocketServer,
} from "../../../../shared/infrastructure/socket/SocketServer";

import {
  RADAR_SOCKET_EVENTS,
} from "./RadarSocketEvents";

export class SocketIoRedCardDetectedPublisher
  implements RedCardDetectedPublisher
{
  constructor(
    private readonly socketServer:
      SocketServer
  ) {}

  public async publish(
    signal:
      RedCardDetectedSignal
  ): Promise<void> {

    this.socketServer.emit(
      RADAR_SOCKET_EVENTS
        .RED_CARD_DETECTED,

      {
        emittedAt:
          new Date()
            .toISOString(),

        signal,
      }
    );

    console.log(
      "[RadarSocket:red-card-detected]",
      signal.match
        .home
        .name,
      "vs",
      signal.match
        .away
        .name,
      `reds=${signal.redCards.home}-${signal.redCards.away}`,
      `providers=${signal.providers.join(",")}`
    );
  }
}
