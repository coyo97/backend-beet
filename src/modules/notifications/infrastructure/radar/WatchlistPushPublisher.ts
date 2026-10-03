import type {
  RadarSignalPublisher,
} from "../../../radar/application/ports/RadarSignalPublisher";

import type {
  RedCardPressureSignal,
} from "../../../radar/domain/entities/RedCardPressureSignal";

import type {
  WatchlistSignalMatcher,
} from "../../../watchlist/application/services/WatchlistSignalMatcher";

import type {
  PushNotificationSender,
} from "../../application/ports/PushNotificationSender";

import type {
  PushDeviceRepository,
} from "../../domain/repositories/PushDeviceRepository";

import type {
  PushReceiptRepository,
} from "../../domain/repositories/PushReceiptRepository";

import type {
  PushPreferencesRepository,
} from "../../domain/repositories/PushPreferencesRepository";


export class WatchlistPushPublisher
  implements RadarSignalPublisher
{
  constructor(
    private readonly matcher:
      WatchlistSignalMatcher,

    private readonly deviceRepository:
      PushDeviceRepository,

    private readonly receiptRepository:
      PushReceiptRepository,

    private readonly preferencesRepository:
      PushPreferencesRepository,

    private readonly sender:
      PushNotificationSender
  ) {}


  public async publish(
    signal:
      RedCardPressureSignal
  ): Promise<void> {

    /*
     * Primero cargamos las
     * preferencias globales.
     */
    const preferences =
      await this
        .preferencesRepository
        .get();


    /*
     * Si las notificaciones
     * están desactivadas,
     * no hacemos ningún trabajo
     * adicional.
     */
    if (
      !preferences.enabled
    ) {
      return;
    }


    /*
     * Si el usuario quiere
     * únicamente señales strong,
     * descartamos las clear.
     */
    if (
      preferences.minimumStrength ===
        "strong" &&
      signal.strength !==
        "strong"
    ) {
      return;
    }


    /*
     * Buscamos todas las
     * coincidencias de Watchlist.
     *
     * Una misma señal puede
     * coincidir por:
     *
     * - partido
     * - equipo
     * - competición
     * - país
     * - regla de radar
     */
    const allMatches =
      await this.matcher
        .execute(
          signal
        );


    /*
     * Después aplicamos las
     * preferencias de tipos
     * de Watchlist.
     */
    const matches =
      allMatches.filter(
        (
          match
        ) => {

          switch (
            match.matchedBy
          ) {

            case "match":
              return preferences
                .watchlistTypes
                .match;


            case "team":
              return preferences
                .watchlistTypes
                .team;


            case "competition":
              return preferences
                .watchlistTypes
                .competition;


            case "country":
              return preferences
                .watchlistTypes
                .country;


            case "radar-rule":
              return preferences
                .watchlistTypes
                .radarRule;


            default:
              return false;
          }
        }
      );


    /*
     * Si ninguna coincidencia
     * pasó los filtros,
     * no enviamos push.
     */
    if (
      matches.length ===
      0
    ) {
      return;
    }


    /*
     * Buscamos únicamente
     * dispositivos activos.
     */
    const devices =
      await this
        .deviceRepository
        .findActive();


    if (
      devices.length ===
      0
    ) {
      return;
    }


    const match =
      signal.match;


    /*
     * Preferimos Flashscore
     * para poder abrir después
     * el detalle del partido.
     */
    const source =
      match.sources.find(
        (
          item
        ) =>
          item.provider ===
          "flashscore"
      ) ??
      match.sources[0];


    const score =
      `${match.home.goals ?? "-"}-${match.away.goals ?? "-"}`;


    /*
     * Aunque una señal coincida
     * con varias entradas de
     * Watchlist, enviamos solo
     * UN push por dispositivo.
     */
    const messages =
      devices.map(
        (
          device
        ) => ({
          to:
            device
              .expoPushToken,

          title:
            "🔴 Football Radar",

          body:
            `${match.home.name} ${score} ${match.away.name} · roja + presión ${signal.strength}`,

          sound:
            "default" as const,

          channelId:
            "radar-alerts",

          data: {
            type:
              "WATCHLIST_ALERT",

            provider:
              source
                ?.provider ??
              null,

            externalId:
              source
                ?.externalId ??
              null,

            watchlistMatches:
              matches.length,

            strength:
              signal.strength,

            homeRedCards:
              signal.redCards.home,

            awayRedCards:
              signal.redCards.away,
          },
        })
      );


    const results =
      await this.sender
        .send(
          messages
        );


    /*
     * Procesamos cada ticket
     * devuelto por Expo.
     */
    for (
      const result
      of results
    ) {

      /*
       * Expo aceptó el push.
       */
      if (
        result.status ===
        "ok"
      ) {

        console.log(
          "[WatchlistPush]",
          "accepted",
          result.receiptId ??
            "-"
        );


        /*
         * Si Expo nos dio
         * receiptId, lo guardamos
         * para comprobar la
         * entrega aproximadamente
         * 15 minutos después.
         */
        if (
          result.receiptId
        ) {

          const sentAt =
            new Date();


          const nextCheckAt =
            new Date(
              sentAt.getTime() +
                15 *
                60 *
                1000
            );


          await this
            .receiptRepository
            .createPending({
              receiptId:
                result.receiptId,

              expoPushToken:
                result.token,

              sentAt,

              nextCheckAt,
            });
        }


        continue;
      }


      /*
       * Si llegamos aquí,
       * Expo rechazó el mensaje
       * antes de generar un
       * receipt válido.
       */
      console.warn(
        "[WatchlistPush]",
        "rejected",
        result.errorCode ??
          "unknown",

        result.message ??
          ""
      );


      /*
       * Si Expo ya sabe que
       * el dispositivo dejó
       * de estar registrado,
       * desactivamos el token
       * inmediatamente.
       */
      if (
        result.errorCode ===
        "DeviceNotRegistered"
      ) {

        await this
          .deviceRepository
          .deactivate(
            result.token
          );


        console.warn(
          "[WatchlistPush]",
          "device deactivated",
          result.token
        );
      }


      /*
       * Estos errores suelen
       * representar un problema
       * de configuración FCM,
       * no del dispositivo.
       */
      if (
        result.errorCode ===
          "MismatchSenderId" ||
        result.errorCode ===
          "InvalidCredentials"
      ) {

        console.error(
          "[WatchlistPush]",
          "FCM configuration error",
          {
            errorCode:
              result.errorCode,

            message:
              result.message,
          }
        );
      }
    }
  }
}
