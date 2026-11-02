
import type {
  PushDevice,
  RegisterPushDeviceInput,
} from "../entities/PushDevice";

export interface PushDeviceRepository {
  register(
    input: RegisterPushDeviceInput
  ): Promise<PushDevice>;

  findActiveByOwner(
    ownerId: string
  ): Promise<PushDevice[]>;

  /*
   * Compatibilidad temporal.
   * No utilizar para envíos personales.
   */
  findActive(): Promise<PushDevice[]>;

  /*
   * Desactivar un dispositivo SOLO
   * cuando pertenece a este usuario.
   */
  deactivateForOwner(
    ownerId: string,
    expoPushToken: string
  ): Promise<void>;

  /*
   * Desactivación existente para
   * tokens inválidos detectados
   * por el procesamiento de recibos.
   */
  deactivate(
    expoPushToken: string
  ): Promise<void>;
}

