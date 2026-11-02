
import mongoose, {
  Schema,
  type Model,
} from "mongoose";

interface DeliveryRecord {
  ownerId: string;
  ruleId: string;
  eventKey: string;

  status: "pending" | "accepted";

  expiresAt: Date;
}

const deliverySchema =
  new Schema<DeliveryRecord>(
    {
      ownerId: {
        type: String,
        required: true,
      },

      ruleId: {
        type: String,
        required: true,
      },

      eventKey: {
        type: String,
        required: true,
      },

      status: {
        type: String,
        enum: ["pending", "accepted"],
        required: true,
      },

      expiresAt: {
        type: Date,
        required: true,
      },
    },
    {
      timestamps: true,
      collection: "alert_rule_deliveries",
    }
  );

deliverySchema.index(
  {
    ownerId: 1,
    ruleId: 1,
    eventKey: 1,
  },
  {
    unique: true,
  }
);

deliverySchema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
  }
);

const DeliveryModel:
  Model<DeliveryRecord> =
    (
      mongoose.models.AlertRuleDelivery as
        Model<DeliveryRecord> | undefined
    ) ??
    mongoose.model<DeliveryRecord>(
      "AlertRuleDelivery",
      deliverySchema
    );

export class AlertRuleDeliveryDedup {

  private indexesReady:
    Promise<void> | null = null;

  private ensureIndexes(): Promise<void> {
    if (!this.indexesReady) {
      this.indexesReady =
        DeliveryModel
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
   * Reserva atómica por:
   * usuario + regla + evento.
   */
  public async claim(
    ownerId: string,
    ruleId: string,
    eventKey: string
  ): Promise<boolean> {

    await this.ensureIndexes();

    const now = new Date();

    /*
     * TTL puede tardar en limpiar,
     * así que eliminamos una reserva
     * caducada del mismo evento.
     */
    await DeliveryModel.deleteOne({
      ownerId,
      ruleId,
      eventKey,
      expiresAt: {
        $lte: now,
      },
    }).exec();

    try {
      await DeliveryModel.create({
        ownerId,
        ruleId,
        eventKey,
        status: "pending",

        expiresAt: new Date(
          now.getTime() +
          2 * 60 * 1000
        ),
      });

      return true;

    } catch (error: unknown) {

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        return false;
      }

      throw error;
    }
  }

  /*
   * Expo aceptó al menos un ticket.
   *
   * El cooldown es configurable
   * desde la regla.
   */
  public async confirm(
    ownerId: string,
    ruleId: string,
    eventKey: string,
    cooldownMinutes: number
  ): Promise<void> {

    await DeliveryModel.updateOne(
      {
        ownerId,
        ruleId,
        eventKey,
        status: "pending",
      },
      {
        $set: {
          status: "accepted",

          expiresAt: new Date(
            Date.now() +
            cooldownMinutes * 60 * 1000
          ),
        },
      }
    ).exec();
  }
}

