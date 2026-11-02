
import type {
  MatchContext,
  RecentResult,
  TeamMatchContext,
} from "../../../match-context/domain/entities/MatchContext";

/*
 * Los datos disponibles pueden ser:
 *
 * - tabla de competición
 * - forma reciente
 * - ambos
 * - ninguno
 *
 * Nunca inventamos información.
 */

function validNonNegative(
  value: number | null
): value is number {

  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
  );
}

function formatForm(
  form: RecentResult[]
): string | null {

  if (
    !Array.isArray(form) ||
    form.length === 0
  ) {
    return null;
  }

  const translations: Record<
    RecentResult,
    string
  > = {
    W: "G",
    D: "E",
    L: "P",
  };

  const results =
    form
      .slice(0, 5)
      .filter(
        value =>
          value === "W" ||
          value === "D" ||
          value === "L"
      )
      .map(
        value =>
          translations[value]
      );

  if (results.length === 0) {
    return null;
  }

  return results.join("-");
}

function formatTeam(
  prefix: "L" | "V",
  team: TeamMatchContext,
  showTable: boolean,
  showForm: boolean
): string | null {

  const parts: string[] = [];

  if (showTable) {

    if (
      validNonNegative(team.position) &&
      team.position > 0
    ) {
      parts.push(
        `${team.position}.º`
      );
    }

    if (
      validNonNegative(team.points)
    ) {
      parts.push(
        `${team.points} pts`
      );
    }
  }

  if (showForm) {
    const form =
      formatForm(team.form);

    if (form) {
      parts.push(
        `forma ${form}`
      );
    }
  }

  if (parts.length === 0) {
    return null;
  }

  return `${prefix}: ${parts.join(" · ")}`;
}

/*
 * Devuelve texto adicional
 * para una notificación de roja.
 *
 * Ejemplo:
 *
 * L: 2.º · 40 pts · forma G-G-E-G-G
 * V: 11.º · 25 pts · forma P-E-P-G-E
 * Diferencia: 15 pts
 */
export function formatRedCardPushContext(
  context: MatchContext | null
): string {

  if (!context) {
    return "";
  }

  /*
   * Son posiciones de la competición
   * del encuentro, no necesariamente
   * de una liga anual doméstica.
   */
  const showTable =
    context.competition.tableAvailable &&
    context.competition.tableScope ===
      "competition" &&
    context.availability.standings;

  const showForm =
    context.availability.recentForm;

  const lines: string[] = [];

  const home =
    formatTeam(
      "L",
      context.home,
      showTable,
      showForm
    );

  const away =
    formatTeam(
      "V",
      context.away,
      showTable,
      showForm
    );

  if (home) {
    lines.push(home);
  }

  if (away) {
    lines.push(away);
  }

  if (
    showTable &&
    validNonNegative(context.home.points) &&
    validNonNegative(context.away.points)
  ) {

    const difference =
      Math.abs(
        context.home.points -
        context.away.points
      );

    if (difference >= 10) {
      lines.push(
        `Diferencia: ${difference} pts`
      );
    }
  }

  if (lines.length === 0) {
    return "";
  }

  return "\n" + lines.join("\n");
}

