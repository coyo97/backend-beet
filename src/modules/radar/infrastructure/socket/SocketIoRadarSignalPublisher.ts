import type {
  RadarSignalPublisher,
} from "../../application/ports/RadarSignalPublisher";

import type {
  RedCardPressureSignal,
} from "../../domain/entities/RedCardPressureSignal";

import type {
  SocketServer,
} from "../../../../shared/infrastructure/socket/SocketServer";

import {
  RADAR_SOCKET_EVENTS,
} from "./RadarSocketEvents";

export class SocketIoRadarSignalPublisher
  implements RadarSignalPublisher
{
  constructor(
    private readonly socketServer:
      SocketServer
  ) {}

  public publish(
    signal:
      RedCardPressureSignal
  ): void {

    this.socketServer.emit(
      RADAR_SOCKET_EVENTS
        .RED_CARD_PRESSURE,

      {
        emittedAt:
          new Date()
            .toISOString(),

        signal,
      }
    );

    console.log(
      "[RadarSocket]",
      signal.match.home.name,
      "vs",
      signal.match.away.name,
      signal.strength
    );
  }
}
