
import type {
  Request,
  Response,
} from "express";

import {
  MongooseUpcomingDailyLimitRepository,
} from "../../infrastructure/repositories/MongooseUpcomingDailyLimitRepository";

export class UpcomingDailyLimitController {

  constructor(
    private readonly repository =
      new MongooseUpcomingDailyLimitRepository()
  ) {}

  /*
   * Identidad exclusivamente del JWT.
   * Nunca aceptar ownerId enviado
   * por el móvil.
   */
  private getOwnerId(
    res: Response
  ): string | null {

    const ownerId =
      res.locals.authUserId;

    if (
      typeof ownerId !== "string" ||
      !/^[a-f0-9]{24}$/i.test(ownerId)
    ) {
      return null;
    }

    return ownerId.toLowerCase();
  }

  /*
   * GET /notifications/upcoming-daily-limit
   */
  public get = async (
    _req: Request,
    res: Response
  ): Promise<void> => {

    const ownerId =
      this.getOwnerId(res);

    if (!ownerId) {
      res.status(401).json({
        message: "Authentication required",
      });
      return;
    }

    try {
      const usage =
        await this.repository.getUsage(
          ownerId
        );

      res.status(200).json({
        dailyLimit: usage.limit,
        used: usage.used,
        remaining: usage.remaining,
        dayTimezone: "UTC",
      });

    } catch (error) {
      console.error(
        "[UpcomingDailyLimit.get]",
        error
      );

      res.status(500).json({
        message:
          "Could not load daily limit",
      });
    }
  };

  /*
   * PATCH /notifications/upcoming-daily-limit
   *
   * Body:
   * {
   *   dailyLimit: 8
   * }
   */
  public update = async (
    req: Request,
    res: Response
  ): Promise<void> => {

    const ownerId =
      this.getOwnerId(res);

    if (!ownerId) {
      res.status(401).json({
        message: "Authentication required",
      });
      return;
    }

    const dailyLimit =
      req.body?.dailyLimit;

    if (
      !Number.isInteger(dailyLimit) ||
      dailyLimit < 1 ||
      dailyLimit > 20
    ) {
      res.status(400).json({
        message:
          "dailyLimit must be an integer from 1 to 20",
      });
      return;
    }

    try {
      await this.repository.setLimit(
        ownerId,
        dailyLimit
      );

      const usage =
        await this.repository.getUsage(
          ownerId
        );

      res.status(200).json({
        dailyLimit: usage.limit,
        used: usage.used,
        remaining: usage.remaining,
        dayTimezone: "UTC",
      });

    } catch (error) {
      console.error(
        "[UpcomingDailyLimit.update]",
        error
      );

      res.status(500).json({
        message:
          "Could not update daily limit",
      });
    }
  };
}

