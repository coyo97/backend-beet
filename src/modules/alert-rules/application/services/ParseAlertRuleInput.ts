
import type {
  AlertRule,
  AlertRuleCondition,
  AlertRuleMetric,
  AlertOperator,
  AlertRuleFilters,
  AlertRuleDelivery,
} from "../../domain/AlertRule";

export type CreateAlertRuleInput =
  Omit<
    AlertRule,
    "id" | "createdAt" | "updatedAt"
  >;

export class InvalidAlertRuleError
  extends Error {}

const METRICS: AlertRuleMetric[] = [
  "totalRedCards",
  "homeRedCards",
  "awayRedCards",
  "minute",
  "pointGap",
  "positionGap",
  "favoritePosition",
  "favoriteGoalsBehind",
  "favoriteAtHome",
  "favoritePressure",
  "favoriteAverageGoals",
  "teamMemoryWins",
  "teamMemoryLosses",
];

const OPERATORS: AlertOperator[] = [
  "eq",
  "gt",
  "gte",
  "lt",
  "lte",
];

function invalid(message: string): never {
  throw new InvalidAlertRuleError(message);
}

function asObject(
  value: unknown
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    invalid("Se esperaba un objeto");
  }

  return value as Record<string, unknown>;
}

function validateKeys(
  object: Record<string, unknown>,
  allowed: string[]
): void {
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key)) {
      invalid(`Campo no permitido: ${key}`);
    }
  }
}

function parseCondition(
  raw: unknown,
  depth = 0
): AlertRuleCondition {

  if (depth > 3) {
    invalid("Demasiados niveles de condiciones");
  }

  const input = asObject(raw);

  if (
    input.kind === "all" ||
    input.kind === "any"
  ) {
    validateKeys(input, [
      "kind",
      "conditions",
    ]);

    if (
      !Array.isArray(input.conditions) ||
      input.conditions.length === 0 ||
      input.conditions.length > 8
    ) {
      invalid("La agrupación debe tener entre 1 y 8 condiciones");
    }

    return {
      kind: input.kind,
      conditions: input.conditions.map(
        item => parseCondition(item, depth + 1)
      ),
    };
  }

  if (input.kind !== "comparison") {
    invalid("Tipo de condición inválido");
  }

  validateKeys(input, [
    "kind",
    "metric",
    "operator",
    "value",
  ]);

  const metric =
    input.metric as AlertRuleMetric;

  const operator =
    input.operator as AlertOperator;

  if (!METRICS.includes(metric)) {
    invalid("Métrica no permitida");
  }

  if (!OPERATORS.includes(operator)) {
    invalid("Operador no permitido");
  }

  const value = input.value;

  if (metric === "favoriteAtHome") {
    if (
      operator !== "eq" ||
      typeof value !== "boolean"
    ) {
      invalid("favoriteAtHome requiere un booleano y operador eq");
    }

    return {
      kind: "comparison",
      metric,
      operator: "eq",
      value,
    };
  }

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    Math.abs(value) > 10000
  ) {
    invalid("El valor de la condición debe ser numérico y finito");
  }

  return {
    kind: "comparison",
    metric,
    operator,
    value,
  };
}

function parseStringList(
  raw: unknown
): string[] {

  if (raw === undefined) {
    return [];
  }

  if (
    !Array.isArray(raw) ||
    raw.length > 50
  ) {
    invalid("Lista de filtros inválida");
  }

  return raw.map(item => {
    if (
      typeof item !== "string" ||
      !item.trim() ||
      item.trim().length > 120
    ) {
      invalid("Valor de filtro inválido");
    }

    return item.trim();
  });
}

export function parseCreateAlertRuleInput(
  raw: unknown,
  ownerId: string
): CreateAlertRuleInput {

  const input = asObject(raw);

  validateKeys(input, [
    "name",
    "enabled",
    "phase",
    "scope",
    "filters",
    "when",
    "delivery",
  ]);

  if (
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.trim().length > 100
  ) {
    invalid("Nombre inválido");
  }

  if (
    input.phase !== "prematch" &&
    input.phase !== "live"
  ) {
    invalid("Fase inválida");
  }

  if (
    input.scope !== "all" &&
    input.scope !== "watchlist"
  ) {
    invalid("Alcance inválido");
  }

  if (
    input.enabled !== undefined &&
    typeof input.enabled !== "boolean"
  ) {
    invalid("enabled debe ser booleano");
  }

  const filtersInput =
    input.filters === undefined
      ? {}
      : asObject(input.filters);

  validateKeys(filtersInput, [
    "countries",
    "competitions",
    "excludedCompetitions",
  ]);

  const filters: AlertRuleFilters = {
    countries:
      parseStringList(filtersInput.countries),

    competitions:
      parseStringList(filtersInput.competitions),

    excludedCompetitions:
      parseStringList(
        filtersInput.excludedCompetitions
      ),
  };

  const deliveryInput =
    input.delivery === undefined
      ? {}
      : asObject(input.delivery);

  validateKeys(deliveryInput, [
    "priority",
    "cooldownMinutes",
    "remindersBeforeKickoff",
  ]);

  const priority =
    deliveryInput.priority ?? "normal";

  if (
    priority !== "high" &&
    priority !== "normal" &&
    priority !== "low"
  ) {
    invalid("Prioridad inválida");
  }

  const cooldown =
    deliveryInput.cooldownMinutes ?? 30;

  if (
    typeof cooldown !== "number" ||
    !Number.isInteger(cooldown) ||
    cooldown < 5 ||
    cooldown > 10080
  ) {
    invalid("Cooldown fuera de rango");
  }

  const reminders =
    deliveryInput.remindersBeforeKickoff ?? [];

  if (
    !Array.isArray(reminders) ||
    reminders.length > 5 ||
    !reminders.every(
      value =>
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= 10080
    )
  ) {
    invalid("Recordatorios inválidos");
  }

  if (
    input.phase === "live" &&
    reminders.length > 0
  ) {
    invalid("Los recordatorios previos requieren fase prematch");
  }

  const delivery: AlertRuleDelivery = {
    priority,
    cooldownMinutes: cooldown,
    remindersBeforeKickoff: reminders,
  };

  return {
    ownerId,
    name: input.name.trim(),

    enabled:
      input.enabled === undefined
        ? true
        : input.enabled,

    phase: input.phase,
    scope: input.scope,
    filters,

    when: parseCondition(input.when),
    delivery,
  };
}

