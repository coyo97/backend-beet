import type {
  MatchLineupProvider,
} from "../ports/MatchLineupProvider";

import type {
  MatchLineupStore,
} from "../ports/MatchLineupStore";

export interface VerifyMatchLineupInput {
  provider:
    string;

  externalId:
    string;
}

export class VerifyMatchLineup {
  constructor(
    private readonly provider:
      MatchLineupProvider,

    private readonly store:
      MatchLineupStore
  ) {}

  public async execute(
    input:
      VerifyMatchLineupInput
  ) {

    const provider =
      input.provider
        .trim();

    const externalId =
      input.externalId
        .trim();

    if (
      !provider ||
      !externalId
    ) {
      throw new Error(
        "provider and externalId are required"
      );
    }

    const sourceKey =
      `${provider}:${externalId}`;

    /*
     * Si ya conocemos la alineación
     * CONFIRMADA, no gastamos otra
     * petición externa.
     */
    const cached =
      await this.store
        .findBySourceKey(
          sourceKey
        );

    if (
      cached?.status ===
      "confirmed"
    ) {
      return {
        source:
          "cache" as const,

        lineup:
          cached,
      };
    }

    if (
      !this.provider
        .supports(
          provider
        )
    ) {
      throw new Error(
        `Unsupported lineup provider: ${provider}`
      );
    }

    const lineup =
      await this.provider
        .getLineup(
          provider,
          externalId
        );

    /*
     * Confirmed y partial sí tienen
     * información útil.
     *
     * unavailable no vale la pena
     * persistirlo como snapshot final,
     * porque posiblemente la alineación
     * todavía no fue publicada.
     */
    if (
      lineup.status !==
      "unavailable"
    ) {
      const saved =
        await this.store
          .upsert(
            lineup
          );

      return {
        source:
          "provider" as const,

        lineup:
          saved,
      };
    }

    return {
      source:
        "provider" as const,

      lineup,
    };
  }
}
