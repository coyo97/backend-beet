import type {
  PushDevice,
  RegisterPushDeviceInput,
} from "../entities/PushDevice";

export interface PushDeviceRepository {
  register(
    input:
      RegisterPushDeviceInput
  ): Promise<
    PushDevice
  >;

  findActive():
    Promise<
      PushDevice[]
    >;

  deactivate(
    expoPushToken:
      string
  ): Promise<void>;
}
