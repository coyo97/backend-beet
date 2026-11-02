
/*
 * Motor de reglas configurables.
 *
 * Las metricas disponibles estan
 * controladas por el backend.
 *
 * El usuario configura condiciones
 * y umbrales, no ejecuta codigo.
 */

export type AlertRulePhase =
  | "prematch"
  | "live";

export type AlertRuleScope =
  | "all"
  | "watchlist";

export type AlertRuleMetric =
  | "totalRedCards"
  | "homeRedCards"
  | "awayRedCards"
  | "minute"
  | "pointGap"
  | "positionGap"
  | "favoritePosition"
  | "favoriteGoalsBehind"
  | "favoriteAtHome"
  | "favoritePressure"
  | "favoriteAverageGoals"
  | "teamMemoryWins"
  | "teamMemoryLosses";

export type AlertOperator =
  | "eq"
  | "gt"
  | "gte"
  | "lt"
  | "lte";

export type AlertRuleCondition =
  | {
      kind: "comparison";

      metric: AlertRuleMetric;

      operator: AlertOperator;

      value: number | boolean;
    }
  | {
      kind: "all";

      conditions:
        AlertRuleCondition[];
    }
  | {
      kind: "any";

      conditions:
        AlertRuleCondition[];
    };

export interface AlertRuleFilters {
  countries?: string[];

  competitions?: string[];

  excludedCompetitions?: string[];
}

export interface AlertRuleDelivery {
  priority:
    | "high"
    | "normal"
    | "low";

  cooldownMinutes: number;

  /*
   * Ejemplo:
   * [1440, 60, 30]
   *
   * Minutos antes del comienzo.
   */
  remindersBeforeKickoff?: number[];
}

export interface AlertRule {
  id: string;

  ownerId: string;

  name: string;

  enabled: boolean;

  phase: AlertRulePhase;

  scope: AlertRuleScope;

  filters: AlertRuleFilters;

  when: AlertRuleCondition;

  delivery: AlertRuleDelivery;

  createdAt: string;

  updatedAt: string;
}

export type AlertFacts =
  Partial<
    Record<
      AlertRuleMetric,
      number | boolean
    >
  >;

