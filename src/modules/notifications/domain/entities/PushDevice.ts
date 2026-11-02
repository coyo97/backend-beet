
export type PushPlatform =
  | "android"
  | "ios";

export interface PushDevice {
  id:
    string;

  /*
   * Usuario propietario.
   *
   * null permite representar
   * registros antiguos sin
   * propietario asignado.
   */
  ownerId:
    string | null;

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
  /*
   * Se obtiene del JWT
   * autenticado en el backend.
   *
   * Nunca debemos confiar en
   * un ownerId enviado libremente
   * desde la aplicación.
   */
  ownerId:
    string;

  expoPushToken:
    string;

  platform:
    PushPlatform;
}

