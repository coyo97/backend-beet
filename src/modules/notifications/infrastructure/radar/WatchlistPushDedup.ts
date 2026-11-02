
import {
  createHash,
} from "node:crypto";

import mongoose, {
  Schema,
} from "mongoose";

import type {
  RedCardPressureSignal,
} from "../../../radar/domain/entities/RedCardPressureSignal";

/*
 * Estados del registro:
 *
 * pending:
 *   Intento reservado para evitar
 *   envíos simultáneos.
 *
 * accepted:
 *   Expo aceptó al menos un mensaje.
 */
interface WatchlistPushDedupPersistence {
  ownerId: string;

  alertKey: string;

  status:
    | "pending"
    | "accepted";

  expiresAt: Date;
}

const schema =
  new Schema<WatchlistPushDedupPersistence>(
    {
      ownerId: {
        type: String,
        required: true,
      },

      alertKey: {
        type: String,
        required: true,
      },

      status: {
        type: String,

        enum: [
          "pending",
          "accepted",
        ],

        required: true,
      },

      expiresAt: {
        type: Date,
        required: true,
      },
    },
    {
      timestamps: true,
    }
  );

/*
 * Impide que dos procesos reserven
 * la misma alerta para el mismo usuario.
 */
schema.index(
  {
    ownerId: 1,
    alertKey: 1,
  },
  {
    unique: true,
  }
);

/*
 * MongoDB elimina automáticamente
 * los registros caducados.
 */
schema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
  }
);

const WatchlistPushDedupModel =
  mongoose.models.WatchlistPushDedup
    ? mongoose.model<WatchlistPushDedupPersistence>(
        "WatchlistPushDedup"
      )
    : mongoose.model<WatchlistPushDedupPersistence>(
        "WatchlistPushDedup",
        schema
      );

export class WatchlistPushDedup {

  /*
   * Una reserva pendiente caduca
   * a los dos minutos.
   *
   * Permite reintentar si el proceso
   * falla antes de confirmar el envío.
   */
  private readonly pendingMs =
    2 * 60 * 1000;

  /*
   * No repetimos la misma situación
   * aceptada durante cuatro horas.
   */
  private readonly acceptedMs =
    4 * 60 * 60 * 1000;

  private indexesReady:
    Promise<void> | null = null;

  private ensureIndexes():
    Promise<void> {

    if (!this.indexesReady) {

      this.indexesReady =
        WatchlistPushDedupModel
          .createIndexes()
          .then(() => undefined)
          .catch(error => {
            this.indexesReady = null;
            throw error;
          });
    }

    return this.indexesReady;
  }

  /*
   * Identidad estable de la señal.
   *
   * No incluimos el minuto del partido
   * porque eso produciría un push nuevo
   * cada vez que avance el reloj.
   *
   * Sí distinguimos:
   * - partido
   * - intensidad
   * - cantidad de rojas
   * - equipo con ventaja
   */
  private buildAlertKey(
    signal: RedCardPressureSignal
  ): string {

    const match =
      signal.match;

    const sources =
      match.sources
        .map(source =>
          `${source.provider}:${source.externalId}`
        )
        .sort();

    const preferredSource =
      sources.find(source =>
        source.startsWith("flashscore:")
      ) ??
      sources[0];

    const matchIdentity =
      preferredSource ??
      [
        match.home.name,
        match.away.name,
        match.kickoffAt,
      ].join(":");

    const identity =
      JSON.stringify([
        matchIdentity,

        signal.strength,

        signal.redCards.home,

        signal.redCards.away,

        signal.advantagedSide ?? null,
      ]);

    return createHash("sha256")
      .update(identity)
      .digest("hex");
  }

  /*
   * Intenta reservar la alerta.
   *
   * Devuelve:
   * - string: reserva conseguida
   * - null: alerta duplicada
   */
  public async claim(
    ownerId: string,
    signal: RedCardPressureSignal
  ): Promise<string | null> {

    if (
      !mongoose.isValidObjectId(ownerId)
    ) {
      throw new Error(
        "Invalid push alert ownerId"
      );
    }

    await this.ensureIndexes();

    const alertKey =
      this.buildAlertKey(signal);


console.log(
  "[PushDedup] evaluate",
  {
    ownerId,

    alertKey:
      alertKey.slice(0, 12),

    match:
      `${signal.match.home.name} vs ${signal.match.away.name}`,

    sources:
      signal.match.sources.map(
        source =>
          `${source.provider}:${source.externalId}`
      ),

    strength:
      signal.strength,

    homeRedCards:
      signal.redCards.home,

    awayRedCards:
      signal.redCards.away,

    advantagedSide:
      signal.advantagedSide ?? null,
  }
);


    const now =
      new Date();

    /*
     * La limpieza TTL de MongoDB
     * no es inmediata.
     *
     * Eliminamos también el registro
     * caducado de esta misma alerta.
     */
    await WatchlistPushDedupModel
      .deleteOne({
        ownerId,
        alertKey,

        expiresAt: {
          $lte: now,
        },
      })
      .exec();

    try {

      await WatchlistPushDedupModel
        .create({
          ownerId,

          alertKey,

          status:
            "pending",

          expiresAt:
            new Date(
              now.getTime() +
              this.pendingMs
            ),
        });

      return alertKey;

    } catch (error: unknown) {

      /*
       * Índice único de MongoDB:
       * otro proceso o ciclo ya reservó
       * esta misma alerta.
       */
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        return null;
      }

      throw error;
    }
  }

  /*
   * Expo aceptó al menos un mensaje.
   *
   * Conservamos el registro durante
   * cuatro horas.
   */
  public async confirm(
    ownerId: string,
    alertKey: string
  ): Promise<void> {

    await WatchlistPushDedupModel
      .updateOne(
        {
          ownerId,
          alertKey,
          status: "pending",
        },
        {
          $set: {
            status:
              "accepted",

            expiresAt:
              new Date(
                Date.now() +
                this.acceptedMs
              ),
          },
        }
      )
      .exec();
  }
}

