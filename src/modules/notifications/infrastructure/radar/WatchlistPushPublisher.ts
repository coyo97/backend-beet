
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
  WatchlistMatchReason,
} from "../../../watchlist/application/services/WatchlistSignalMatcher";

import {
  WatchlistPushDedup,
} from "./WatchlistPushDedup";

import type {
  PushNotificationMessage,
  PushNotificationSender,
  PushSendResult,
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

import type {
  PushPreferences,
} from "../../domain/entities/PushPreferences";

export class WatchlistPushPublisher
  implements RadarSignalPublisher
{
	/*
 * Control persistente de duplicados.
 */
private readonly dedup =
  new WatchlistPushDedup();

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

  /*
   * Una señal de Radar se evalúa
   * individualmente para cada usuario.
   *
   * Nunca usamos findActive() para
   * enviar mensajes indiscriminadamente.
   */
  public async publish(
    signal: RedCardPressureSignal
  ): Promise<void> {

    const ownerIds =
      await this.matcher
        .findActiveOwnerIds();

    if (ownerIds.length === 0) {
      return;
    }

    for (const ownerId of ownerIds) {
      try {
        await this.publishForOwner(
          signal,
          ownerId
        );
      } catch (error) {
        /*
         * Un error de un usuario
         * no debe impedir procesar
         * las alertas de los demás.
         */
        console.error(
          "[WatchlistPush] owner processing failed",
          ownerId,
          error
        );
      }
    }
  }

  private async publishForOwner(
    signal: RedCardPressureSignal,
    ownerId: string
  ): Promise<void> {

    /*
     * Preferencias exclusivamente
     * de este propietario.
     */
    const preferences =
      await this.preferencesRepository
        .get(ownerId);

    if (!preferences.enabled) {
      return;
    }

    if (
      preferences.minimumStrength ===
        "strong" &&
      signal.strength !== "strong"
    ) {
      return;
    }

    /*
     * Coincidencias de la Watchlist
     * perteneciente a este usuario.
     */
    const allMatches =
      await this.matcher.execute(
        signal,
        ownerId
      );

    const matches =
      allMatches.filter(
        match =>
          this.isTypeEnabled(
            match.matchedBy,
            preferences
          )
      );

    if (matches.length === 0) {
      return;
    }

    /*
     * Solo dispositivos activos
     * asociados a este usuario.
     */
    const devices =
      await this.deviceRepository
        .findActiveByOwner(ownerId);

    if (devices.length === 0) {
      return;
    }

    const match = signal.match;

    const source =
      match.sources.find(
        item =>
          item.provider ===
          "flashscore"
      ) ??
      match.sources[0];

    const score =
      `${match.home.goals ?? "-"}-${match.away.goals ?? "-"}`;

    /*
     * Una notificación por dispositivo,
     * aunque varias reglas de Watchlist
     * coincidan simultáneamente.
     */
    const messages:
      PushNotificationMessage[] =
        devices.map(
          device => ({
            to:
              device.expoPushToken,

            title:
              "🔴 Football Radar",

            body:
              `${match.home.name} ${score} ${match.away.name} · roja + presión ${signal.strength}`,

            sound:
              "default",

            channelId:
              "radar-alerts",

            data: {
              type:
                "WATCHLIST_ALERT",

              provider:
                source?.provider ?? null,

              externalId:
                source?.externalId ?? null,

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

  
/*
 * Reservamos la alerta solo después
 * de confirmar que:
 *
 * - las preferencias permiten enviarla
 * - hubo coincidencias de Watchlist
 * - el usuario tiene dispositivos activos
 *
 * De este modo no bloqueamos alertas
 * de usuarios sin dispositivos.
 */
const alertKey =
  await this.dedup.claim(
    ownerId,
    signal
  );

if (!alertKey) {
  console.log(
    "[WatchlistPush] duplicate skipped",
    ownerId
  );

  return;
}

/*
 * El envío utiliza exclusivamente
 * los dispositivos de este usuario.
 */
const results =
  await this.sender.send(
    messages
  );

/*
 * Un ticket OK significa que Expo
 * aceptó el mensaje para procesarlo.
 *
 * La entrega definitiva se comprobará
 * mediante los recibos existentes.
 */
const accepted =
  results.some(
    result =>
      result.status === "ok"
  );

if (accepted) {
  await this.dedup.confirm(
    ownerId,
    alertKey
  );
}


    console.log(
      "[WatchlistPush]",
      "owner:",
      ownerId,
      "matches:",
      matches.length,
      "devices:",
      devices.length,
      "accepted:",
      results.filter(
        result =>
          result.status === "ok"
      ).length
    );

    await this.processResults(
      results
    );
  }

  /*
   * Aplicar preferencias por tipo
   * de entrada de Watchlist.
   */
  private isTypeEnabled(
    type: WatchlistMatchReason,
    preferences: PushPreferences
  ): boolean {

    switch (type) {
      case "match":
        return preferences
          .watchlistTypes.match;

      case "team":
        return preferences
          .watchlistTypes.team;

      case "competition":
        return preferences
          .watchlistTypes.competition;

      case "country":
        return preferences
          .watchlistTypes.country;

      case "radar-rule":
        return preferences
          .watchlistTypes.radarRule;

      default:
        return false;
    }
  }

  /*
   * Procesamiento de tickets de Expo.
   *
   * Conservamos los recibos para
   * verificar posteriormente la entrega.
   */
  private async processResults(
    results: PushSendResult[]
  ): Promise<void> {

    for (const result of results) {

      if (result.status === "ok") {

        if (result.receiptId) {

          const sentAt =
            new Date();

          const nextCheckAt =
            new Date(
              sentAt.getTime() +
              15 * 60 * 1000
            );

          await this.receiptRepository
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

      console.warn(
        "[WatchlistPush] rejected",
        result.errorCode ?? "unknown",
        result.message ?? ""
      );

      /*
       * El token dejó de ser válido.
       */
      if (
        result.errorCode ===
        "DeviceNotRegistered"
      ) {
        await this.deviceRepository
          .deactivate(
            result.token
          );

        console.warn(
          "[WatchlistPush] invalid device deactivated"
        );
      }

      /*
       * Problemas de credenciales FCM.
       */
      if (
        result.errorCode ===
          "MismatchSenderId" ||
        result.errorCode ===
          "InvalidCredentials"
      ) {
        console.error(
          "[WatchlistPush] FCM configuration error",
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

