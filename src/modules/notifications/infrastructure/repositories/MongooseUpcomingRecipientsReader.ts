
import mongoose from "mongoose";

import {
  PushDeviceModel,
} from "../database/models/PushDeviceModel";

interface PreferencesReader {
  get(ownerId: string): Promise<{
    enabled: boolean;
  }>;
}

interface UpcomingOptInReader {
  getForOwner(
    ownerId: string,
    expoPushToken: string
  ): Promise<boolean>;
}

export interface UpcomingOwnerRecipients {
  ownerId: string;
  tokens: string[];
}

export interface UpcomingRecipientsResult {
  globalEnabled: boolean;
  activeDevices: number;
  optedInDevices: number;

  /*
   * Compatibilidad con los diagnósticos
   * y el despachador actual.
   */
  tokens: string[];

  /*
   * NUEVO:
   * dispositivos agrupados por cuenta.
   */
  ownerRecipients: UpcomingOwnerRecipients[];
}

export class MongooseUpcomingRecipientsReader {

  constructor(
    private readonly preferences:
      PreferencesReader,

    private readonly optIns:
      UpcomingOptInReader
  ) {}

  public async execute():
    Promise<UpcomingRecipientsResult> {

    const devices =
      await PushDeviceModel
        .find({
          active: true,
          ownerId: { $ne: null },
        })
        .select({
          ownerId: 1,
          expoPushToken: 1,
        })
        .lean()
        .exec();

    const grouped =
      new Map<string, Set<string>>();

    for (const device of devices) {

      const ownerId =
        device.ownerId?.toString();

      const token =
        device.expoPushToken?.trim();

      if (
        !ownerId ||
        !mongoose.isValidObjectId(ownerId) ||
        !token
      ) {
        continue;
      }

      const tokens =
        grouped.get(ownerId) ??
        new Set<string>();

      tokens.add(token);

      grouped.set(ownerId, tokens);
    }

    const ownerRecipients:
      UpcomingOwnerRecipients[] = [];

    const allTokens =
      new Set<string>();

    let activeDevices = 0;
    let enabledOwners = 0;

    for (const [ownerId, tokens] of grouped) {

      activeDevices += tokens.size;

      try {

        /*
         * Preferencias generales
         * de este propietario.
         */
        const preferences =
          await this.preferences.get(ownerId);

        if (!preferences.enabled) {
          continue;
        }

        enabledOwners++;

        const authorizedTokens:
          string[] = [];

        /*
         * Consentimiento Upcoming
         * independiente por teléfono.
         */
        for (const token of tokens) {

          const enabled =
            await this.optIns.getForOwner(
              ownerId,
              token
            );

          if (!enabled) {
            continue;
          }

          authorizedTokens.push(token);
          allTokens.add(token);
        }

        /*
         * Solamente incluir cuentas
         * con al menos un teléfono
         * autorizado.
         */
        if (authorizedTokens.length > 0) {

          ownerRecipients.push({
            ownerId,
            tokens: authorizedTokens,
          });
        }

      } catch (error) {

        /*
         * Fallar cerrado para esta cuenta.
         * No habilitar destinatarios sin
         * confirmar sus permisos.
         */
        console.error(
          "[UpcomingRecipients] owner failed",
          error instanceof Error
            ? error.message
            : "Unknown error"
        );
      }
    }

    return {
      globalEnabled:
        enabledOwners > 0,

      activeDevices,

      optedInDevices:
        allTokens.size,

      tokens:
        [...allTokens],

      ownerRecipients,
    };
  }
}

