
import {
  createHash,
} from "node:crypto";

import {
  TeamMemoryLiveVolumePolicyModel,
  TeamMemoryLiveVolumeUsageModel,
} from "../database/models/TeamMemoryLiveVolumeModels";

export const TEAM_MEMORY_COOLDOWNS =
  [0, 15, 30, 60, 120] as const;

export interface TeamMemoryVolumePolicy {
  dailyLimit: number;
  cooldownMinutes: number;
}

export interface TeamMemoryVolumeStatus
  extends TeamMemoryVolumePolicy {
  used: number;
  remaining: number;
  nextAllowedAt: string | null;
  dayTimezone: "UTC";
}

export class MongooseTeamMemoryLiveVolumeRepository {

  private owner(ownerId: string): string {
    if (
      typeof ownerId !== "string" ||
      !/^[a-f0-9]{24}$/i.test(ownerId)
    ) {
      throw new Error("Invalid ownerId");
    }

    return ownerId.toLowerCase();
  }

  private dayKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  /*
   * Configuración predeterminada.
   * No creamos documentos por cada lectura.
   */
  public async getPolicy(
    ownerId: string
  ): Promise<TeamMemoryVolumePolicy> {

    const owner = this.owner(ownerId);

    const policy =
      await TeamMemoryLiveVolumePolicyModel
        .findOne({ ownerId: owner })
        .lean()
        .exec();

    return {
      dailyLimit: policy?.dailyLimit ?? 4,
      cooldownMinutes:
        policy?.cooldownMinutes ?? 30,
    };
  }

  /*
   * Configuración modificable
   * por el usuario autenticado.
   */
  public async setPolicy(
    ownerId: string,
    dailyLimit: number,
    cooldownMinutes: number
  ): Promise<TeamMemoryVolumePolicy> {

    const owner = this.owner(ownerId);

    if (
      !Number.isInteger(dailyLimit) ||
      dailyLimit < 1 ||
      dailyLimit > 20
    ) {
      throw new Error("Invalid dailyLimit");
    }

    if (
      !TEAM_MEMORY_COOLDOWNS.some(
        value => value === cooldownMinutes
      )
    ) {
      throw new Error("Invalid cooldownMinutes");
    }

    await TeamMemoryLiveVolumePolicyModel
      .findOneAndUpdate(
        { ownerId: owner },
        {
          $set: {
            dailyLimit,
            cooldownMinutes,
          },
        },
        {
          upsert: true,
          returnDocument: "after",
          runValidators: true,
        }
      )
      .exec();

    return {
      dailyLimit,
      cooldownMinutes,
    };
  }

  /*
   * Estado para mostrar en la APK.
   */
  public async getUsage(
    ownerId: string
  ): Promise<TeamMemoryVolumeStatus> {

    const owner = this.owner(ownerId);
    const now = new Date();

    const [policy, usage] =
      await Promise.all([
        this.getPolicy(owner),

        TeamMemoryLiveVolumeUsageModel
          .findOne({ ownerId: owner })
          .lean()
          .exec(),
      ]);

    const sameDay =
      usage?.dayKey === this.dayKey(now);

    const used =
      sameDay
        ? usage?.eventKeys.length ?? 0
        : 0;

    const lastReserved =
      usage?.lastReservedAt
        ? new Date(usage.lastReservedAt)
        : null;

    const nextAllowed =
      lastReserved
        ? new Date(
            lastReserved.getTime() +
            policy.cooldownMinutes * 60_000
          )
        : null;

    return {
      ...policy,
      used,
      remaining: Math.max(
        0,
        policy.dailyLimit - used
      ),

      nextAllowedAt:
        nextAllowed &&
        nextAllowed.getTime() > now.getTime()
          ? nextAllowed.toISOString()
          : null,

      dayTimezone: "UTC",
    };
  }

  /*
   * Reserva atómica de un evento.
   *
   * true:
   *   - nuevo evento autorizado, o
   *   - mismo evento ya reservado
   *     para completar otros teléfonos.
   *
   * false:
   *   - límite diario agotado, o
   *   - intervalo mínimo no cumplido.
   */
  public async tryReserve(
    ownerId: string,
    matchKey: string
  ): Promise<boolean> {

    const owner = this.owner(ownerId);

    if (
      typeof matchKey !== "string" ||
      !matchKey.trim()
    ) {
      throw new Error("Invalid matchKey");
    }

    const now = new Date();
    const dayKey = this.dayKey(now);

    const policy =
      await this.getPolicy(owner);

    /*
     * Hash con día:
     * no guardar información deportiva
     * personal en el contador.
     */
    const eventKey =
      createHash("sha256")
        .update(
          `${dayKey}|${matchKey.trim()}`
        )
        .digest("hex");

    const cutoff =
      new Date(
        now.getTime() -
        policy.cooldownMinutes * 60_000
      );

    /*
     * Inicialización protegida
     * por índice único ownerId.
     */
    try {
      await TeamMemoryLiveVolumeUsageModel
        .updateOne(
          { ownerId: owner },
          {
            $setOnInsert: {
              ownerId: owner,
              dayKey: "1970-01-01",
              eventKeys: [],
              lastReservedAt: null,
            },
          },
          { upsert: true }
        )
        .exec();

    } catch (error) {
      const duplicate =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000;

      if (!duplicate) {
        throw error;
      }
    }

    /*
     * Una sola operación MongoDB:
     *
     * - comprueba cupos diarios
     * - comprueba intervalo mínimo
     * - impide repetir evento
     * - agrega evento y actualiza fecha
     *
     * Dos procesos concurrentes
     * no pueden superar el máximo.
     */
    const result =
      await TeamMemoryLiveVolumeUsageModel
        .updateOne(
          {
            ownerId: owner,

            eventKeys: {
              $ne: eventKey,
            },

            $or: [
              { lastReservedAt: null },

              {
                lastReservedAt: {
                  $lte: cutoff,
                },
              },
            ],

            $expr: {
              $or: [
                {
                  $ne: ["$dayKey", dayKey],
                },

                {
                  $lt: [
                    {
                      $size: {
                        $ifNull: [
                          "$eventKeys",
                          [],
                        ],
                      },
                    },
                    policy.dailyLimit,
                  ],
                },
              ],
            },
          },
          [
            {
              $set: {
                dayKey,

                eventKeys: {
                  $concatArrays: [
                    {
                      $cond: [
                        {
                          $eq: [
                            "$dayKey",
                            dayKey,
                          ],
                        },

                        {
                          $ifNull: [
                            "$eventKeys",
                            [],
                          ],
                        },

                        [],
                      ],
                    },

                    [eventKey],
                  ],
                },

                lastReservedAt: now,
              },
            },
          ],
          {
            updatePipeline: true,
          }
        )
        .exec();

    if (result.modifiedCount === 1) {
      return true;
    }

    /*
     * Si otro teléfono o proceso
     * ya reservó exactamente el
     * mismo evento, permitir continuar.
     *
     * No incrementa consumo.
     * El ClaimTeamMemoryLiveDelivery
     * sigue evitando duplicados por token.
     */
    const alreadyReserved =
      await TeamMemoryLiveVolumeUsageModel
        .exists({
          ownerId: owner,
          dayKey,
          eventKeys: eventKey,
        })
        .exec();

    return alreadyReserved !== null;
  }
}

