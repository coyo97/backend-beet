import type {
  MatchIncident,
} from "../../../football/domain/entities/MatchIncident";

export class RedCardDetector {
  public isRedCard(
    incident:
      MatchIncident
  ): boolean {

    const value =
      [
        incident.type,
        incident.reason,
        incident.description,
      ]
        .filter(Boolean)
        .join(" ")
        .normalize("NFD")
        .replace(
          /[\u0300-\u036f]/g,
          ""
        )
        .toLowerCase();

    return (
      value.includes(
        "red card"
      ) ||

      value.includes(
        "second yellow"
      ) ||

      value.includes(
        "2nd yellow"
      ) ||

      value.includes(
        "yellow-red"
      ) ||

      value.includes(
        "yellow red"
      )
    );
  }
}
