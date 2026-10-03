import type {
  PushPreferences,
  UpdatePushPreferencesInput,
} from "../entities/PushPreferences";

export interface PushPreferencesRepository {
  get():
    Promise<
      PushPreferences
    >;

  update(
    input:
      UpdatePushPreferencesInput
  ): Promise<
    PushPreferences
  >;
}
