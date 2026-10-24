import type {
  Request,
  Response,
} from "express";

import type {
  InspectMatchLineup,
} from "../../application/use-cases/InspectMatchLineup";

export class TeamLineupController {
  constructor(
    private readonly inspectMatchLineup:
      InspectMatchLineup
  ) {}

  public inspect =
    async (
      req:
        Request,

      res:
        Response
    ): Promise<
      Response
    > => {

      try {

        const provider =
          typeof req.body
            ?.provider ===
            "string"
            ? req.body
                .provider
                .trim()
            : "";

        const externalId =
          typeof req.body
            ?.externalId ===
            "string"
            ? req.body
                .externalId
                .trim()
            : "";

        if (
          !provider ||
          !externalId
        ) {

          return res
            .status(400)
            .json({
              message:
                "provider and externalId are required",
            });
        }

        const rawLimit =
          req.body
            ?.historyLimit;

        const historyLimit =
          typeof rawLimit ===
            "number"
            ? rawLimit
            : typeof rawLimit ===
                "string"
              ? Number(
                  rawLimit
                )
              : undefined;

        const result =
          await this
            .inspectMatchLineup
            .execute({
              provider,

              externalId,

              bootstrapHistory:
                req.body
                  ?.bootstrapHistory ===
                true,

              historyLimit:
                Number.isFinite(
                  historyLimit
                )
                  ? historyLimit
                  : undefined,
            });

        return res
          .status(200)
          .json(
            result
          );

      } catch (
        error
      ) {

        console.error(
          "[TeamLineupController.inspect]",
          error
        );

        return res
          .status(502)
          .json({
            message:
              error instanceof
                Error
                ? error.message
                : "Could not inspect match lineup",
          });
      }
    };
}
