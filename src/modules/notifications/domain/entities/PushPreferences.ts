export type PushMinimumStrength =
  | "clear"
  | "strong";

export interface PushWatchlistTypes {
  match:
    boolean;

  team:
    boolean;

  competition:
    boolean;

  country:
    boolean;

  radarRule:
    boolean;
}

export interface PushPreferences {
  enabled:
    boolean;

  minimumStrength:
    PushMinimumStrength;

  watchlistTypes:
    PushWatchlistTypes;

  updatedAt:
    string;
}

export interface UpdatePushPreferencesInput {
  enabled?:
    boolean;

  minimumStrength?:
    PushMinimumStrength;

  watchlistTypes?:
    Partial<
      PushWatchlistTypes
    >;
}
