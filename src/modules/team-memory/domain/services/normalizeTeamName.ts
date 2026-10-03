export function normalizeTeamName(
  value: string
): string {

  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .trim()
    .toLowerCase()
    .replace(
      /[-_.]/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    );
}
