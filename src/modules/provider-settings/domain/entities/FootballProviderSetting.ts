export const FOOTBALL_PROVIDER_KEYS = [
  "sofascore",
  "flashscore",
  "fotmob",
  "api-football",
  "1xbet",
] as const;

export type FootballProviderKey =
  typeof FOOTBALL_PROVIDER_KEYS[
    number
  ];

export interface StoredFootballProviderSetting {
  key:
    FootballProviderKey;

  enabled:
    boolean;

  createdAt:
    string;

  updatedAt:
    string;
}

export interface FootballProviderState {
  key:
    FootballProviderKey;

  enabled:
    boolean;

  source:
    "default" |
    "stored";

  updatedAt:
    string |
    null;
}

export interface FootballProviderSettingChanged {
  key:
    FootballProviderKey;

  enabled:
    boolean;
}

export function isFootballProviderKey(
  value:
    string
): value is FootballProviderKey {

  return (
    FOOTBALL_PROVIDER_KEYS as
      readonly string[]
  ).includes(
    value
  );
}
