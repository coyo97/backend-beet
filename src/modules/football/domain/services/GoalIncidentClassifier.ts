import type {
  MatchIncident,
} from "../entities/MatchIncident";

export interface ParsedIncidentMinute {
  baseMinute:
    number |
    null;

  addedTime:
    number;

  effectiveMinute:
    number |
    null;
}

export class GoalIncidentClassifier {

  public isGoal(
    incident:
      MatchIncident
  ): boolean {

    /*
     * Flashscore comprobado:
     *
     * "Goal"
     *
     * SofaScore normalmente normaliza
     * incidentType como "goal".
     *
     * Ignoramos mayúsculas/minúsculas,
     * pero NO hacemos includes("goal")
     * porque podríamos clasificar cosas
     * como "Disallowed Goal".
     */
    return (
      this.normalize(
        incident.type
      ) ===
      "goal"
    );
  }

  public parseMinute(
    incident:
      MatchIncident
  ): ParsedIncidentMinute {

    const fromText =
      this.parseMinuteText(
        incident.minute
      );

    if (
      fromText
        .effectiveMinute !==
      null
    ) {
      return fromText;
    }

    const base =
      incident.minuteNumber;

    return {
      baseMinute:
        base,

      addedTime:
        0,

      effectiveMinute:
        base,
    };
  }

  private parseMinuteText(
    value:
      string |
      null
  ): ParsedIncidentMinute {

    if (!value) {
      return {
        baseMinute:
          null,

        addedTime:
          0,

        effectiveMinute:
          null,
      };
    }

    /*
     * Soporta:
     *
     * 33'
     * 45+2'
     * 90+7'
     *
     * También tolera espacios.
     */
    const match =
      value
        .trim()
        .match(
          /^(\d+)(?:\s*\+\s*(\d+))?/
        );

    if (!match) {
      return {
        baseMinute:
          null,

        addedTime:
          0,

        effectiveMinute:
          null,
      };
    }

    const baseMinute =
      Number(
        match[1]
      );

    const addedTime =
      match[2]
        ? Number(
            match[2]
          )
        : 0;

    if (
      !Number.isFinite(
        baseMinute
      ) ||
      !Number.isFinite(
        addedTime
      )
    ) {
      return {
        baseMinute:
          null,

        addedTime:
          0,

        effectiveMinute:
          null,
      };
    }

    return {
      baseMinute,

      addedTime,

      effectiveMinute:
        baseMinute +
        addedTime,
    };
  }

  private normalize(
    value:
      string |
      null
  ): string {

    return (
      value ??
      ""
    )
      .trim()
      .toLowerCase();
  }
}
