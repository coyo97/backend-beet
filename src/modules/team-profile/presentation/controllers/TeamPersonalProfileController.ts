import type {
  Request,
  Response,
} from "express";

import type {
  TeamPersonalLabel,
} from "../../domain/entities/TeamPersonalProfile";

import type {
  SaveTeamPersonalProfile,
} from "../../application/use-cases/SaveTeamPersonalProfile";

import type {
  GetTeamPersonalProfile,
} from "../../application/use-cases/GetTeamPersonalProfile";

import type {
  GetTeamPersonalProfiles,
} from "../../application/use-cases/GetTeamPersonalProfiles";

export class TeamPersonalProfileController {
  constructor(
    private readonly saveUseCase:
      SaveTeamPersonalProfile,

    private readonly getUseCase:
      GetTeamPersonalProfile,

    private readonly listUseCase:
      GetTeamPersonalProfiles
  ) {}

  private getOwnerId(
    req:
      Request
  ): string | null {

    const raw =
      req.headers[
        "x-football-radar-owner-id"
      ];

    const value =
      Array.isArray(
        raw
      )
        ? raw[0]
        : raw;

    if (
      typeof value !==
        "string"
    ) {
      return null;
    }

    const ownerId =
      value.trim();

    if (
      ownerId.length <
        8 ||
      ownerId.length >
        128
    ) {
      return null;
    }

    return ownerId;
  }

  public list =
    async (
      req:
        Request,

      res:
        Response
    ) => {

      try {
        const ownerId =
          this.getOwnerId(
            req
          );

        if (
          !ownerId
        ) {
          return res
            .status(400)
            .json({
              message:
                "x-football-radar-owner-id is required",
            });
        }

        const items =
          await this
            .listUseCase
            .execute(
              ownerId
            );

        return res.json({
          items,
        });
      } catch (
        error
      ) {

        console.error(
          "[TeamPersonalProfileController.list]",
          error
        );

        return res
          .status(500)
          .json({
            message:
              error instanceof
                Error
                ? error.message
                : "Could not list team profiles",
          });
      }
    };

  public get =
    async (
      req:
        Request,

      res:
        Response
    ) => {

      try {
        const ownerId =
          this.getOwnerId(
            req
          );

        if (
          !ownerId
        ) {
          return res
            .status(400)
            .json({
              message:
                "x-football-radar-owner-id is required",
            });
        }

        const team =
          typeof req.query
            .team ===
          "string"
            ? req.query.team
            : "";

        const profile =
          await this
            .getUseCase
            .execute(
              ownerId,
              team
            );

        return res.json({
          profile,
        });
      } catch (
        error
      ) {

        return res
          .status(400)
          .json({
            message:
              error instanceof
                Error
                ? error.message
                : "Could not load team profile",
          });
      }
    };

  public save =
    async (
      req:
        Request,

      res:
        Response
    ) => {

      try {
        const ownerId =
          this.getOwnerId(
            req
          );

        if (
          !ownerId
        ) {
          return res
            .status(400)
            .json({
              message:
                "x-football-radar-owner-id is required",
            });
        }

        const {
          teamName,
          label,
          note,
        } =
          req.body ?? {};

        const profile =
          await this
            .saveUseCase
            .execute(
              ownerId,
              {
                teamName:
                  typeof teamName ===
                    "string"
                    ? teamName
                    : "",

                label:
                  typeof label ===
                    "string"
                    ? label as
                      TeamPersonalLabel
                    : null,

                note:
                  typeof note ===
                    "string"
                    ? note
                    : null,
              }
            );

        return res.json({
          profile,
        });
      } catch (
        error
      ) {

        console.error(
          "[TeamPersonalProfileController.save]",
          error
        );

        return res
          .status(400)
          .json({
            message:
              error instanceof
                Error
                ? error.message
                : "Could not save team profile",
          });
      }
    };
}
