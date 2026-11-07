
import mongoose from "mongoose";

import type {
  Request,
  Response,
} from "express";

import {
  InvalidAlertRuleError,
  parseCreateAlertRuleInput,
} from "../../application/services/ParseAlertRuleInput";

import type {
  MongooseAlertRuleRepository,
} from "../../infrastructure/repositories/MongooseAlertRuleRepository";

export class AlertRulesController {
  constructor(
    private readonly repository:
      MongooseAlertRuleRepository
  ) {}

  /*
   * El propietario siempre viene
   * del middleware JWT.
   */
  private ownerId(
    res: Response
  ): string | null {

    const value =
      res.locals.authUserId;

    return (
      typeof value === "string" &&
      mongoose.isValidObjectId(value)
    )
      ? value
      : null;
  }

  public list = async (
    _req: Request,
    res: Response
  ): Promise<Response> => {

    const ownerId = this.ownerId(res);

    if (!ownerId) {
      return res.status(401).json({
        message: "AUTH_REQUIRED",
      });
    }

    try {
      const rules =
        await this.repository
          .findByOwner(ownerId);

      return res.status(200).json({
        count: rules.length,
        rules,
      });
    } catch (error) {
      console.error(
        "[AlertRules.list]",
        error
      );

      return res.status(500).json({
        message: "Could not load rules",
      });
    }
  };

  public create = async (
    req: Request,
    res: Response
  ): Promise<Response> => {

    const ownerId = this.ownerId(res);

    if (!ownerId) {
      return res.status(401).json({
        message: "AUTH_REQUIRED",
      });
    }

    try {
      const input =
        parseCreateAlertRuleInput(
          req.body,
          ownerId
        );

      const rule =
        await this.repository
          .create(input);

      return res.status(201).json({
        rule,
      });

    } catch (error) {
      if (
        error instanceof InvalidAlertRuleError ||
        error instanceof mongoose.Error.ValidationError
      ) {
        return res.status(400).json({
          message: error.message,
        });
      }

      console.error(
        "[AlertRules.create]",
        error
      );

      return res.status(500).json({
        message: "Could not create rule",
      });
    }
  };


public replace = async (
  req: Request,
  res: Response
): Promise<Response> => {

  const ownerId =
    this.ownerId(res);

  if (!ownerId) {
    return res.status(401).json({
      message: "AUTH_REQUIRED",
    });
  }

  const rawId = req.params.id;

  const id =
    Array.isArray(rawId)
      ? rawId[0]
      : rawId;

  if (
    !id ||
    !mongoose.isValidObjectId(id)
  ) {
    return res.status(400).json({
      message: "Invalid rule ID",
    });
  }

  try {
    /*
     * Validamos la regla completa.
     * ownerId siempre procede del JWT.
     */
    const input =
      parseCreateAlertRuleInput(
        req.body,
        ownerId
      );

    const rule =
      await this.repository.replace(
        ownerId,
        id,
        input
      );

    if (!rule) {
      return res.status(404).json({
        message: "Rule not found",
      });
    }

    return res.status(200).json({
      rule,
    });

  } catch (error) {

    if (
      error instanceof InvalidAlertRuleError ||
      error instanceof mongoose.Error.ValidationError
    ) {
      return res.status(400).json({
        message: error.message,
      });
    }

    console.error(
      "[AlertRules.replace]",
      error
    );

    return res.status(500).json({
      message: "Could not update rule",
    });
  }
};


  public setEnabled = async (
    req: Request,
    res: Response
  ): Promise<Response> => {

    const ownerId = this.ownerId(res);

    if (!ownerId) {
      return res.status(401).json({
        message: "AUTH_REQUIRED",
      });
    }

    const rawId = req.params.id;
    const id = Array.isArray(rawId)
      ? rawId[0]
      : rawId;

    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid rule ID",
      });
    }

    if (typeof req.body?.enabled !== "boolean") {
      return res.status(400).json({
        message: "enabled must be boolean",
      });
    }

    try {
      const rule =
        await this.repository
          .setEnabled(
            ownerId,
            id,
            req.body.enabled
          );

      if (!rule) {
        return res.status(404).json({
          message: "Rule not found",
        });
      }

      return res.status(200).json({
        rule,
      });

    } catch (error) {
      console.error(
        "[AlertRules.setEnabled]",
        error
      );

      return res.status(500).json({
        message: "Could not update rule",
      });
    }
  };

  public remove = async (
    req: Request,
    res: Response
  ): Promise<Response> => {

    const ownerId = this.ownerId(res);

    if (!ownerId) {
      return res.status(401).json({
        message: "AUTH_REQUIRED",
      });
    }

    const rawId = req.params.id;
    const id = Array.isArray(rawId)
      ? rawId[0]
      : rawId;

    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid rule ID",
      });
    }

    try {
      const deleted =
        await this.repository
          .delete(ownerId, id);

      if (!deleted) {
        return res.status(404).json({
          message: "Rule not found",
        });
      }

      return res.status(200).json({
        deleted: true,
      });

    } catch (error) {
      console.error(
        "[AlertRules.remove]",
        error
      );

      return res.status(500).json({
        message: "Could not delete rule",
      });
    }
  };
}

