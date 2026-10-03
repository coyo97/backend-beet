export type PushPlatform =
  | "android"
  | "ios";

export interface PushDevice {
  id:
    string;

  expoPushToken:
    string;

  platform:
    PushPlatform;

  active:
    boolean;

  lastSeenAt:
    string;

  createdAt:
    string;

  updatedAt:
    string;
}

export interface RegisterPushDeviceInput {
  expoPushToken:
    string;

  platform:
    PushPlatform;
}
