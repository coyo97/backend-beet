import type {
  SaveTeamPersonalProfileInput,
  TeamPersonalLabel,
} from "../../domain/entities/TeamPersonalProfile";

import type {
  TeamPersonalProfileRepository,
} from "../../domain/repositories/TeamPersonalProfileRepository";

const VALID_LABELS:
  TeamPersonalLabel[] =
  [
    "avoid",
    "watch",
    "trusted",
  ];

export class SaveTeamPersonalProfile {
  constructor(
    private readonly repository:
      TeamPersonalProfileRepository
  ) {}

  public async execute(
    ownerId:
      string,

    input:
      SaveTeamPersonalProfileInput
  ) {

    const teamName =
      input.teamName
        .trim();

    if (
      !teamName
    ) {
      throw new Error(
        "teamName is required"
      );
    }

    const label =
      input.label ??
      null;

    if (
      label !==
        null &&
      !VALID_LABELS.includes(
        label
      )
    ) {
      throw new Error(
        "Invalid team label"
      );
    }

    const note =
      input.note
        ?.trim() ??
      "";

    if (
      note.length >
      500
    ) {
      throw new Error(
        "Team note cannot exceed 500 characters"
      );
    }

    /*
     * Si quitaste etiqueta y nota,
     * realmente eliminamos el perfil.
     */
    if (
      label ===
        null &&
      !note
    ) {
      await this.repository
        .deleteByTeam(
          ownerId,
          teamName
        );

      return null;
    }

    return this.repository
      .save(
        ownerId,
        {
          teamName,

          label,

          note:
            note ||
            null,
        }
      );
  }
}
