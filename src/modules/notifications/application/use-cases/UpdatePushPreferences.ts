import type {
  UpdatePushPreferencesInput,
} from "../../domain/entities/PushPreferences";

import type {
  PushPreferencesRepository,
} from "../../domain/repositories/PushPreferencesRepository";

export class UpdatePushPreferences {
  constructor(
    private readonly repository:
      PushPreferencesRepository
  ) {}

  public execute(
    input:
      UpdatePushPreferencesInput
  ) {
    return this.repository
      .update(
        input
      );
  }
}
