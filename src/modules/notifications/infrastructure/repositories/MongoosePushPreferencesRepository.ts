
import type {
  PushPreferences,
  PushWatchlistTypes,
  UpdatePushPreferencesInput,
} from "../../domain/entities/PushPreferences";

import type {
  PushPreferencesRepository,
} from "../../domain/repositories/PushPreferencesRepository";

import {
  PushPreferencesModel,
  type PushPreferencesDocument,
} from "../database/models/PushPreferencesModel";

const DEFAULT_TYPES: PushWatchlistTypes = {
  match: true,
  team: true,
  competition: true,
  country: true,
  radarRule: true,
};

const WATCHLIST_TYPE_KEYS = [
  "match",
  "team",
  "competition",
  "country",
  "radarRule",
] as const;

export class MongoosePushPreferencesRepository
  implements PushPreferencesRepository
{
  /*
   * Cada usuario tiene una clave
   * individual en MongoDB.
   *
   * Nunca aceptamos "default"
   * como propietario.
   */
  private buildKey(
    ownerId?: string
  ): string | null {

    if (
      typeof ownerId !== "string" ||
      !/^[a-f0-9]{24}$/i.test(
        ownerId
      )
    ) {
      return null;
    }

    return (
      `user:${ownerId.toLowerCase()}`
    );
  }

  /*
   * Seguridad para llamadas antiguas:
   * nunca devolvemos las preferencias
   * globales que podrian activar
   * notificaciones para todos.
   */
  private disabledPreferences():
    PushPreferences {

    return {
      enabled: false,

      minimumStrength: "strong",

      watchlistTypes: {
        match: false,
        team: false,
        competition: false,
        country: false,
        radarRule: false,
      },

      updatedAt:
        new Date(0).toISOString(),
    };
  }

  public async get(
    ownerId?: string
  ): Promise<PushPreferences> {

    const key =
      this.buildKey(ownerId);

    if (!key) {
      return this.disabledPreferences();
    }

    /*
     * Creamos las preferencias
     * predeterminadas solamente
     * para este usuario.
     */
    const document =
      await PushPreferencesModel
        .findOneAndUpdate(
          {
            key,
          },
          {
            $setOnInsert: {
              key,

              enabled: true,

              minimumStrength:
                "clear",

              watchlistTypes: {
                ...DEFAULT_TYPES,
              },
            },
          },
          {
            new: true,

            upsert: true,

            setDefaultsOnInsert: true,
          }
        )
        .exec();

    if (!document) {
      throw new Error(
        "Could not load push preferences"
      );
    }

    return this.toDomain(document);
  }

  public async update(
    input: UpdatePushPreferencesInput,
    ownerId?: string
  ): Promise<PushPreferences> {

    const key =
      this.buildKey(ownerId);

    if (!key) {
      throw new Error(
        "Authenticated owner is required"
      );
    }

    /*
     * Solo consultamos preferencias
     * pertenecientes al mismo usuario.
     */
    const current =
      await this.get(ownerId);

    const watchlistTypes: PushWatchlistTypes = {
      ...current.watchlistTypes,
    };

    /*
     * Admitimos solamente los
     * cinco campos booleanos
     * definidos en el dominio.
     */
    for (
      const type
      of WATCHLIST_TYPE_KEYS
    ) {
      const value =
        input.watchlistTypes?.[type];

      if (
        typeof value === "boolean"
      ) {
        watchlistTypes[type] =
          value;
      }
    }

    const enabled =
      typeof input.enabled === "boolean"
        ? input.enabled
        : current.enabled;

    const minimumStrength =
      input.minimumStrength === "clear" ||
      input.minimumStrength === "strong"
        ? input.minimumStrength
        : current.minimumStrength;

    const document =
      await PushPreferencesModel
        .findOneAndUpdate(
          {
            key,
          },
          {
            $set: {
              enabled,

              minimumStrength,

              watchlistTypes,
            },
          },
          {
            new: true,
          }
        )
        .exec();

    if (!document) {
      throw new Error(
        "Push preferences document could not be updated"
      );
    }

    return this.toDomain(document);
  }

  private toDomain(
    document: PushPreferencesDocument
  ): PushPreferences {

    return {
      enabled:
        document.enabled,

      minimumStrength:
        document.minimumStrength,

      watchlistTypes: {
        match:
          document.watchlistTypes.match,

        team:
          document.watchlistTypes.team,

        competition:
          document.watchlistTypes.competition,

        country:
          document.watchlistTypes.country,

        radarRule:
          document.watchlistTypes.radarRule,
      },

      updatedAt:
        document.updatedAt.toISOString(),
    };
  }
}

