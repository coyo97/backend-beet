import type {
  Request,
  Response,
} from "express";

import type {
  SendTestPush,
} from "../../application/use-cases/SendTestPush";

import type {
  GetPushPreferences,
} from "../../application/use-cases/GetPushPreferences";

import type {
  UpdatePushPreferences,
} from "../../application/use-cases/UpdatePushPreferences";

import type {
  RegisterPushDevice,
} from "../../application/use-cases/RegisterPushDevice";

export class NotificationController {
  constructor(
    private readonly registerPushDevice:
    RegisterPushDevice,

  private readonly sendTestPush:
    SendTestPush,

  private readonly getPushPreferences:
    GetPushPreferences,

  private readonly updatePushPreferences:
    UpdatePushPreferences
  ) {}

  public registerDevice =
    async (
      req: Request,
      res: Response
    ): Promise<Response> => {

      try {
        const {
          expoPushToken,
          platform,
        } =
          req.body ?? {};

        if (
          typeof expoPushToken !==
            "string" ||
          (
            platform !==
              "android" &&
            platform !==
              "ios"
          )
        ) {
          return res
            .status(400)
            .json({
              message:
                "expoPushToken and valid platform are required",
            });
        }

        const device =
          await this
            .registerPushDevice
            .execute({
              expoPushToken,
              platform,
            });

        return res
          .status(200)
          .json({
            device,
          });
      } catch (error) {
        console.error(
          "[NotificationController.registerDevice]",
          error
        );

        return res
          .status(400)
          .json({
            message:
              error instanceof
                Error
                ? error.message
                : "Could not register device",
          });
      }
    };
	public testPush =
  async (
    _req: Request,
    res: Response
  ): Promise<Response> => {

    try {
      const result =
        await this
          .sendTestPush
          .execute();

      return res
        .status(200)
        .json(result);
    } catch (error) {
      console.error(
        "[NotificationController.testPush]",
        error
      );

      return res
        .status(500)
        .json({
          message:
            error instanceof Error
              ? error.message
              : "Could not send push",
        });
    }
  };
  public getPreferences =
  async (
    _req: Request,
    res: Response
  ): Promise<Response> => {

    const preferences =
      await this
        .getPushPreferences
        .execute();

    return res.json({
      preferences,
    });
  };

public updatePreferences =
  async (
    req: Request,
    res: Response
  ): Promise<Response> => {

    try {
      const {
        enabled,
        minimumStrength,
        watchlistTypes,
      } =
        req.body ?? {};

      if (
        enabled !==
          undefined &&
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

      if (
        minimumStrength !==
          undefined &&
        minimumStrength !==
          "clear" &&
        minimumStrength !==
          "strong"
      ) {
        return res
          .status(400)
          .json({
            message:
              "minimumStrength must be clear or strong",
          });
      }

      const preferences =
        await this
          .updatePushPreferences
          .execute({
            enabled,
            minimumStrength,
            watchlistTypes,
          });

      return res.json({
        preferences,
      });
    } catch (error) {
      console.error(
        "[NotificationController.updatePreferences]",
        error
      );

      return res
        .status(500)
        .json({
          message:
            "Could not update push preferences",
        });
    }
  };
}
