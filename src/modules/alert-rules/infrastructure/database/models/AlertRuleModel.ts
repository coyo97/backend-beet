
import mongoose, {
  Schema,
  type HydratedDocument,
  type Model,
  type Types,
} from "mongoose";

import type {
  AlertRuleCondition,
  AlertRuleDelivery,
  AlertRuleFilters,
  AlertRulePhase,
  AlertRuleScope,
} from "../../../domain/AlertRule";

export interface AlertRulePersistence {
  ownerId: Types.ObjectId;
  name: string;
  enabled: boolean;
  phase: AlertRulePhase;
  scope: AlertRuleScope;
  filters: AlertRuleFilters;
  when: AlertRuleCondition;
  delivery: AlertRuleDelivery;
  createdAt: Date;
  updatedAt: Date;
}

export type AlertRuleDocument =
  HydratedDocument<AlertRulePersistence>;

const metrics = new Set([
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
]);

const operators = new Set([
  "eq",
  "gt",
  "gte",
  "lt",
  "lte",
]);

function isValidCondition(
  value: unknown,
  depth = 0
): boolean {

  if (
    depth > 3 ||
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const condition =
    value as Record<string, unknown>;

  if (condition.kind === "comparison") {

    if (
      !metrics.has(String(condition.metric)) ||
      !operators.has(String(condition.operator))
    ) {
      return false;
    }

    if (typeof condition.value === "boolean") {
      return condition.operator === "eq";
    }

    return (
      typeof condition.value === "number" &&
      Number.isFinite(condition.value) &&
      Math.abs(condition.value) <= 10000
    );
  }

  if (
    condition.kind === "all" ||
    condition.kind === "any"
  ) {
    const children =
      condition.conditions;

    return (
      Array.isArray(children) &&
      children.length > 0 &&
      children.length <= 8 &&
      children.every(child =>
        isValidCondition(child, depth + 1)
      )
    );
  }

  return false;
}

const filtersSchema =
  new Schema(
    {
      countries: {
        type: [String],
        default: [],
      },

      competitions: {
        type: [String],
        default: [],
      },

      excludedCompetitions: {
        type: [String],
        default: [],
      },
    },
    {
      _id: false,
      strict: "throw",
    }
  );

const deliverySchema =
  new Schema(
    {
      priority: {
        type: String,
        enum: ["high", "normal", "low"],
        required: true,
      },

      cooldownMinutes: {
        type: Number,
        min: 5,
        max: 10080,
        required: true,
      },

      remindersBeforeKickoff: {
        type: [Number],
        default: [],

        validate: {
          validator: (values: number[]) =>
            values.length <= 5 &&
            values.every(
              value =>
                Number.isInteger(value) &&
                value >= 0 &&
                value <= 10080
            ),
          message: "Invalid reminder schedule",
        },
      },
    },
    {
      _id: false,
      strict: "throw",
    }
  );

const alertRuleSchema =
  new Schema<AlertRulePersistence>(
    {
      ownerId: {
        type: Schema.Types.ObjectId,
        required: true,
        index: true,
      },

      name: {
        type: String,
        trim: true,
        minlength: 1,
        maxlength: 100,
        required: true,
      },

      enabled: {
        type: Boolean,
        default: true,
      },

      phase: {
        type: String,
        enum: ["prematch", "live"],
        required: true,
      },

      scope: {
        type: String,
        enum: ["all", "watchlist"],
        required: true,
      },

      filters: {
        type: filtersSchema,
        default: () => ({}),
      },


when: {
  type: Schema.Types.Mixed,
  required: true,

  validate: {
    validator: (value: unknown): boolean =>
      isValidCondition(value),

    message: "Invalid alert rule condition",
  },
},


      delivery: {
        type: deliverySchema,
        required: true,
      },
    },
    {
      timestamps: true,
      strict: "throw",
      collection: "alert_rules",
    }
  );

alertRuleSchema.index({
  ownerId: 1,
  enabled: 1,
  phase: 1,
});

export const AlertRuleModel:
  Model<AlertRulePersistence> =
    (
      mongoose.models.AlertRule as
        Model<AlertRulePersistence> | undefined
    ) ??
    mongoose.model<AlertRulePersistence>(
      "AlertRule",
      alertRuleSchema
    );

