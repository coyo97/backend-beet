
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
    signal: RedCardPressureSignal
  ): Promise<void> {

    /*
     * Solo propietarios que tienen
     * entradas activas en Watchlist.
     */
    const ownerIds =
      await this.matcher
        .findActiveOwnerIds();

    if (ownerIds.length === 0) {
      return;
    }

    for (const ownerId of ownerIds) {
      try {
        const matches =
          await this.matcher.execute(
            signal,
            ownerId
          );

        if (matches.length === 0) {
          continue;
        }

        /*
         * Una alerta por usuario y señal,
         * aunque coincidan varias reglas.
         *
         * Conservamos el formato anterior
         * para los consumidores móviles.
         */
        const firstMatch =
          matches[0];

        const room =
          `user:${ownerId}`;


this.socketServer.emitToUsers(
  [ownerId],

  WATCHLIST_SOCKET_EVENTS.ALERT,

  {
    emittedAt:
      new Date().toISOString(),

    matchedBy:
      firstMatch.matchedBy,

    watchlistItem:
      firstMatch.item,

    signal,
  }
);


        console.log(
          "[WatchlistAlert]",
          "room:",
          room,
          "matches:",
          matches.length,
          "match:",
          signal.match.home.name,
          "vs",
          signal.match.away.name
        );

      } catch (error) {
        /*
         * Un error de un usuario
         * no interrumpe el procesamiento
         * de los demás.
         */
        console.error(
          "[WatchlistAlert] owner failed",
          ownerId,
          error
        );
      }
    }
  }
}

