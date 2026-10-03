import type {
  PushDevice,
  RegisterPushDeviceInput,
} from "../../domain/entities/PushDevice";

import type {
  PushDeviceRepository,
} from "../../domain/repositories/PushDeviceRepository";

export class RegisterPushDevice {
  constructor(
    private readonly repository:
      PushDeviceRepository
  ) {}

  public execute(
    input:
      RegisterPushDeviceInput
  ): Promise<
    PushDevice
  > {

    const token =
      input.expoPushToken
        .trim();

    if (
      !token.startsWith(
        "ExponentPushToken["
      ) &&
      !token.startsWith(
        "ExpoPushToken["
      )
    ) {
      throw new Error(
        "Invalid Expo push token"
      );
    }

    return this.repository
      .register({
        ...input,

        expoPushToken:
          token,
      });
  }
}
