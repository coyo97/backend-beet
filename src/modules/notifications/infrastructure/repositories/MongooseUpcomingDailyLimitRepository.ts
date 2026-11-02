
import {
  createHash,
} from "node:crypto";

import {
  UpcomingDailyPolicyModel,
  UpcomingDailyUsageModel,
} from "../database/models/UpcomingDailyNotificationModels";

export class MongooseUpcomingDailyLimitRepository {

  private normalizeOwner(
    ownerId: string
  ): string {

    if (
      typeof ownerId !== "string" ||
      !/^[a-f0-9]{24}$/i.test(ownerId)
    ) {
      throw new Error(
        "Invalid ownerId"
      );
    }

    return ownerId.toLowerCase();
  }

  /*
   * Valor predeterminado:
   * 8 avisos diarios por cuenta.
   */
  public async getLimit(
    ownerId: string
  ): Promise<number> {

    const owner =
      this.normalizeOwner(ownerId);

    const policy =
      await UpcomingDailyPolicyModel
        .findOne({ ownerId: owner })
        .lean()
        .exec();

    return policy?.dailyLimit ?? 8;
  }

  /*
   * Lo utilizará el endpoint PATCH
   * autenticado desde la APK.
   *
   * El backend obtiene ownerId
   * exclusivamente del JWT.
   */
  public async setLimit(
    ownerId: string,
    dailyLimit: number
  ): Promise<number> {

    const owner =
      this.normalizeOwner(ownerId);

    if (
      !Number.isInteger(dailyLimit) ||
      dailyLimit < 1 ||
      dailyLimit > 20
    ) {
      throw new Error(
        "dailyLimit must be between 1 and 20"
      );
    }

    await UpcomingDailyPolicyModel
      .findOneAndUpdate(
        { ownerId: owner },
        {
          $set: { dailyLimit },
        },
        {
          upsert: true,
          returnDocument: "after",
          runValidators: true,
        }
      )
      .exec();

    return dailyLimit;
  }

  /*
   * Devuelve el consumo actual
   * sin modificarlo.
   */
  public async getUsage(
    ownerId: string
  ): Promise<{
    used: number;
    limit: number;
    remaining: number;
  }> {

    const owner =
      this.normalizeOwner(ownerId);

    const dayKey =
      new Date().toISOString().slice(0, 10);

    const [limit, usage] =
      await Promise.all([
        this.getLimit(owner),
        UpcomingDailyUsageModel
          .findOne({
            ownerId: owner,
            dayKey,
          })
          .lean()
          .exec(),
      ]);

    const used =
      usage?.eventKeys.length ?? 0;

    return {
      used,
      limit,
      remaining:
        Math.max(0, limit - used),
    };
  }

  /*
   * Reserva atómica de un evento.
   *
   * Devuelve:
   * true  -> evento registrado
   * false -> evento repetido o sin cupo
   *
   * Las escrituras concurrentes no
   * pueden superar el límite.
   */
  public async tryReserve(
    ownerId: string,
    matchKey: string,
    window: "24h" | "60m"
  ): Promise<boolean> {

    const owner =
      this.normalizeOwner(ownerId);

    if (
      !matchKey.trim() ||
      (window !== "24h" && window !== "60m")
    ) {
      throw new Error(
        "Invalid upcoming event"
      );
    }

    const limit =
      await this.getLimit(owner);

    const now = new Date();
    const dayKey =
      now.toISOString().slice(0, 10);

    const eventKey =
      createHash("sha256")
        .update(`${matchKey.trim()}|${window}`)
        .digest("hex");

    const expiresAt =
      new Date(
        now.getTime() +
        8 * 24 * 60 * 60 * 1000
      );

    /*
     * Crear el contador del día
     * si todavía no existe.
     *
     * El índice único protege frente
     * a ejecuciones simultáneas.
     */
    try {
      await UpcomingDailyUsageModel
        .updateOne(
          {
            ownerId: owner,
            dayKey,
          },
          {
            $setOnInsert: {
              eventKeys: [],
              expiresAt,
            },
          },
          {
            upsert: true,
          }
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
     * Una única escritura atómica
     * comprueba simultáneamente:
     *
     * - evento no registrado
     * - número de eventos < límite
     *
     * Solo si ambas se cumplen
     * añade el nuevo evento.
     */
    const result =
      await UpcomingDailyUsageModel
        .updateOne(
          {
            ownerId: owner,
            dayKey,

            eventKeys: {
              $ne: eventKey,
            },

            $expr: {
              $lt: [
                {
                  $size: "$eventKeys",
                },
                limit,
              ],
            },
          },
          {
            $addToSet: {
              eventKeys: eventKey,
            },
          }
        )
        .exec();

		/*
 * Nuevo evento: consume un cupo.
 */
if (result.modifiedCount === 1) {
  return true;
}

/*
 * Evento ya reservado por esta cuenta:
 * puede continuar su entrega sin
 * consumir otro cupo.
 *
 * Las reservas individuales por token
 * evitarán enviar dos veces al mismo
 * teléfono.
 */
const alreadyCounted =
  await UpcomingDailyUsageModel
    .exists({
      ownerId: owner,
      dayKey,
      eventKeys: eventKey,
    });

return alreadyCounted !== null;
  }
}

