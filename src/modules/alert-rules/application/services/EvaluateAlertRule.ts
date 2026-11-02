
import type {
  AlertFacts,
  AlertRuleCondition,
} from "../../domain/AlertRule";

/*
 * Evalua una condicion utilizando
 * datos normalizados del partido.
 *
 * Si falta un dato, no inventamos
 * un valor ni damos por cumplida
 * la condicion.
 */
export class EvaluateAlertRule {

  public execute(
    condition: AlertRuleCondition,
    facts: AlertFacts
  ): boolean {

    if (condition.kind === "all") {
      return (
        condition.conditions.length > 0 &&
        condition.conditions.every(
          item => this.execute(item, facts)
        )
      );
    }

    if (condition.kind === "any") {
      return (
        condition.conditions.length > 0 &&
        condition.conditions.some(
          item => this.execute(item, facts)
        )
      );
    }

    const actual =
      facts[condition.metric];

    if (
      actual === undefined ||
      actual === null
    ) {
      return false;
    }

    const expected =
      condition.value;

    if (
      condition.operator === "eq"
    ) {
      return (
        typeof actual === typeof expected &&
        actual === expected
      );
    }

    if (
      typeof actual !== "number" ||
      typeof expected !== "number" ||
      !Number.isFinite(actual) ||
      !Number.isFinite(expected)
    ) {
      return false;
    }

    switch (condition.operator) {
      case "gt":
        return actual > expected;

      case "gte":
        return actual >= expected;

      case "lt":
        return actual < expected;

      case "lte":
        return actual <= expected;

      default:
        return false;
    }
  }
}

