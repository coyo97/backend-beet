
import type {
  Request,
  Response,
} from "express";

import {
  MongooseTeamMemoryLiveVolumeRepository,
  TEAM_MEMORY_COOLDOWNS,
} from "../../infrastructure/repositories/MongooseTeamMemoryLiveVolumeRepository";

export class TeamMemoryLiveVolumeController {

  constructor(
    private readonly repository =
      new MongooseTeamMemoryLiveVolumeRepository()
  ) {}

  /*
   * Cuenta autenticada mediante JWT.
   * Nunca usar req.body.ownerId.
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
   * GET /notifications/team-memory-volume
   */
  public get = async (
    _req: Request,
    res: Response
  ): Promise<void> => {

    const ownerId = this.getOwnerId(res);

    if (!ownerId) {
      res.status(401).json({
        message: "Authentication required",
      });
      return;
    }

    try {
      const status =
        await this.repository.getUsage(ownerId);

      res.status(200).json(status);

    } catch (error) {
      console.error(
        "[TeamMemoryVolume.get]",
        error
      );

      res.status(500).json({
        message:
          "Could not load Team Memory volume",
      });
    }
  };

  /*
   * PATCH /notifications/team-memory-volume
   *
   * Body:
   * {
   *   dailyLimit: 4,
   *   cooldownMinutes: 30
   * }
   */
  public update = async (
    req: Request,
    res: Response
  ): Promise<void> => {

    const ownerId = this.getOwnerId(res);

    if (!ownerId) {
      res.status(401).json({
        message: "Authentication required",
      });
      return;
    }

    const {
      dailyLimit,
      cooldownMinutes,
    } = req.body ?? {};

    const validLimit =
      Number.isInteger(dailyLimit) &&
      dailyLimit >= 1 &&
      dailyLimit <= 20;

    const validCooldown =
      typeof cooldownMinutes === "number" &&
      TEAM_MEMORY_COOLDOWNS.some(
        value => value === cooldownMinutes
      );

    if (!validLimit || !validCooldown) {
      res.status(400).json({
        message:
          "Invalid dailyLimit or cooldownMinutes",
        allowedCooldowns:
          TEAM_MEMORY_COOLDOWNS,
      });
      return;
    }

    try {
      await this.repository.setPolicy(
        ownerId,
        dailyLimit,
        cooldownMinutes
      );

      const status =
        await this.repository.getUsage(ownerId);

      res.status(200).json(status);

    } catch (error) {
      console.error(
        "[TeamMemoryVolume.update]",
        error
      );

      res.status(500).json({
        message:
          "Could not update Team Memory volume",
      });
    }
  };
}

