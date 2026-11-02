
import type {
  PushPreferencesRepository,
} from "../../domain/repositories/PushPreferencesRepository";

export class GetPushPreferences {
  constructor(
    private readonly repository:
      PushPreferencesRepository
  ) {}

  public execute(
    ownerId: string
  ) {
    return this.repository.get(
      ownerId
    );
  }
}

