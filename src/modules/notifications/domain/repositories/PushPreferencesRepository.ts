
import type {
  PushPreferences,
  UpdatePushPreferencesInput,
} from "../entities/PushPreferences";

export interface PushPreferencesRepository {
  /*
   * Compatibilidad temporal:
   * sin ownerId devuelve preferencias
   * desactivadas, nunca las globales.
   */
  get(
    ownerId?: string
  ): Promise<PushPreferences>;

  /*
   * Sin propietario valido
   * no se permite modificar nada.
   */
  update(
    input: UpdatePushPreferencesInput,
    ownerId?: string
  ): Promise<PushPreferences>;
}

