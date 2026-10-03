import type {
  Request,
  Response,
} from "express";

import type {
  AddTeamMemoryEvent,
} from "../../application/use-cases/AddTeamMemoryEvent";

import type {
  DeleteTeamMemoryEvent,
} from "../../application/use-cases/DeleteTeamMemoryEvent";

import type {
  GetTeamMemoryHistory,
} from "../../application/use-cases/GetTeamMemoryHistory";

import type {
  GetTeamMemorySummaries,
} from "../../application/use-cases/GetTeamMemorySummaries";

export class TeamMemoryController {
  constructor(
    private readonly addEvent:
      AddTeamMemoryEvent,

    private readonly getSummaries:
      GetTeamMemorySummaries,

    private readonly getHistory:
      GetTeamMemoryHistory,

    private readonly deleteEventUseCase:
      DeleteTeamMemoryEvent
  ) {}

  public summaries =
    async (
      req:
        Request,

      res:
        Response
    ) => {

      const teams =
        Array.isArray(
          req.body?.teams
        )
          ? req.body.teams
              .filter(
                (
                  value:
                    unknown
                ):
                  value is
                    string =>
                  typeof value ===
                  "string"
              )
          : [];

      const summaries =
        await this
          .getSummaries
          .execute(
            teams
          );

      return res.json({
        summaries,
      });
    };

  public history =
    async (
      req:
        Request,

      res:
        Response
    ) => {

      const team =
        typeof req.query.team ===
          "string"
          ? req.query.team
              .trim()
          : "";

      const rawLimit =
        typeof req.query.limit ===
          "string"
          ? Number(
              req.query.limit
            )
          : 20;

      if (!team) {
        return res
          .status(400)
          .json({
            message:
              "team query parameter is required",
          });
      }

      const limit =
        Number.isFinite(
          rawLimit
        )
          ? rawLimit
          : 20;

      const items =
        await this
          .getHistory
          .execute(
            team,
            limit
          );

      return res.json({
        items,
      });
    };

  public createEvent =
    async (
      req:
        Request,

      res:
        Response
    ) => {

      try {
        const {
          teamName,
          outcome,
          opponentName,
          competitionName,
          kickoffAt,
          provider,
          externalId,
          note,
        } =
          req.body ??
          {};

        if (
          typeof teamName !==
            "string" ||
          !teamName.trim()
        ) {
          return res
            .status(400)
            .json({
              message:
                "teamName is required",
            });
        }

        if (
          outcome !==
            "win" &&
          outcome !==
            "loss"
        ) {
          return res
            .status(400)
            .json({
              message:
                "outcome must be win or loss",
            });
        }

        const result =
          await this
            .addEvent
            .execute({
              teamName,

              outcome,

              opponentName:
                typeof opponentName ===
                "string"
                  ? opponentName
                  : null,

              competitionName:
                typeof competitionName ===
                "string"
                  ? competitionName
                  : null,

              kickoffAt:
                typeof kickoffAt ===
                "string"
                  ? kickoffAt
                  : null,

              provider:
                typeof provider ===
                "string"
                  ? provider
                  : null,

              externalId:
                typeof externalId ===
                "string"
                  ? externalId
                  : null,

              note:
                typeof note ===
                "string"
                  ? note
                  : null,
            });

        return res
          .status(201)
          .json(
            result
          );
      } catch (
        error
      ) {

        console.error(
          "[TeamMemoryController.createEvent]",
          error
        );

        return res
          .status(500)
          .json({
            message:
              error instanceof
                Error
                ? error.message
                : "Could not save team memory",
          });
      }
    };

  public deleteEvent =
    async (
      req:
        Request,

      res:
        Response
    ) => {

      try {
        const id =
          String(
            req.params.id ??
              ""
          );

        if (!id) {
          return res
            .status(400)
            .json({
              message:
                "id is required",
            });
        }

        const result =
          await this
            .deleteEventUseCase
            .execute(
              id
            );

        if (!result) {
          return res
            .status(404)
            .json({
              message:
                "Team memory event not found",
            });
        }

        return res.json(
          result
        );
      } catch (
        error
      ) {

        console.error(
          "[TeamMemoryController.deleteEvent]",
          error
        );

        return res
          .status(500)
          .json({
            message:
              error instanceof
                Error
                ? error.message
                : "Could not delete team memory event",
          });
      }
    };
}
