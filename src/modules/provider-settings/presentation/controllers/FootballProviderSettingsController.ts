import type {
  Request,
  Response,
} from "express";

import {
  isFootballProviderKey,
} from "../../domain/entities/FootballProviderSetting";

import type {
  GetFootballProviderSettings,
} from "../../application/use-cases/GetFootballProviderSettings";

import type {
  SetFootballProviderEnabled,
} from "../../application/use-cases/SetFootballProviderEnabled";

export class FootballProviderSettingsController {

  constructor(
    private readonly getSettings:
      GetFootballProviderSettings,

    private readonly setProviderEnabled:
      SetFootballProviderEnabled
  ) {}

  public list =
    async (
      _req:
        Request,

      res:
        Response
    ) => {

      try {
        const items =
          await this
            .getSettings
            .execute();

        return res.json({
          items,
        });

      } catch (
        error
      ) {

        console.error(
          "[ProviderSettings.list]",
          error
        );

        return res
          .status(500)
          .json({
            message:
              "Could not load provider settings",
          });
      }
    };

  public setEnabled =
    async (
      req:
        Request,

      res:
        Response
    ) => {

      const key =
        String(
          req.params.key ??
          ""
        );

      if (
        !isFootballProviderKey(
          key
        )
      ) {
        return res
          .status(400)
          .json({
            message:
              "Unknown football provider",
          });
      }

      const enabled =
        req.body
          ?.enabled;

      if (
        typeof enabled !==
        "boolean"
      ) {
        return res
          .status(400)
          .json({
            message:
              "enabled must be boolean",
          });
      }

      try {
        const item =
          await this
            .setProviderEnabled
            .execute(
              key,
              enabled
            );

        return res.json({
          item,
        });

      } catch (
        error
      ) {

        console.error(
          "[ProviderSettings.setEnabled]",
          error
        );

        return res
          .status(500)
          .json({
            message:
              "Could not update provider",
          });
      }
    };
}
