
import type {
  Request,
  Response,
} from "express";

import type {
  SendTestPush,
} from "../../application/use-cases/SendTestPush";

import type {
  UnregisterPushDevice,
} from "../../application/use-cases/UnregisterPushDevice";

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
      UpdatePushPreferences,

    private readonly unregisterPushDevice:
      UnregisterPushDevice
  ) {}

  /*
   * Obtener el propietario autenticado.
   *
   * El ownerId proviene del JWT
   * verificado por requireAuth.
   *
   * No confiamos en un ownerId
   * enviado desde el móvil.
   */
  private getOwnerId(
    res: Response
  ): string | null {

    const ownerId =
      res.locals.authUserId;

    return typeof ownerId === "string"
      ? ownerId
      : null;
  }

  /*
   * ========================================
   * REGISTER DEVICE
   * ========================================
   *
   * POST /notifications/devices
   */
  public registerDevice =
    async (
      req: Request,
      res: Response
    ): Promise<Response> => {

      const ownerId =
        this.getOwnerId(res);

      if (!ownerId) {
        return res
          .status(401)
          .json({
            message: "Sesión requerida",
          });
      }

      try {
        const {
          expoPushToken,
          platform,
        } = req.body ?? {};

        if (
          typeof expoPushToken !== "string" ||
          (
            platform !== "android" &&
            platform !== "ios"
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
          await this.registerPushDevice
            .execute({
              ownerId,
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
              error instanceof Error
                ? error.message
                : "Could not register device",
          });
      }
    };

  /*
   * ========================================
   * UNREGISTER DEVICE
   * ========================================
   *
   * POST /notifications/devices/unregister
   *
   * Desactiva únicamente el dispositivo
   * perteneciente al usuario autenticado.
   *
   * No elimina el usuario ni sus datos.
   */
  public unregisterDevice =
    async (
      req: Request,
      res: Response
    ): Promise<Response> => {

      const ownerId =
        this.getOwnerId(res);

      if (!ownerId) {
        return res
          .status(401)
          .json({
            message: "Sesión requerida",
          });
      }

      const expoPushToken =
        req.body?.expoPushToken;

      if (
        typeof expoPushToken !== "string" ||
        !expoPushToken.trim()
      ) {
        return res
          .status(400)
          .json({
            message:
              "expoPushToken is required",
          });
      }

      try {
        await this.unregisterPushDevice
          .execute({
            ownerId,
            expoPushToken,
          });

        return res
          .status(200)
          .json({
            unregistered: true,
          });

      } catch (error) {
        console.error(
          "[NotificationController.unregisterDevice]",
          error
        );

        return res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Could not unregister device",
          });
      }
    };

  /*
   * ========================================
   * TEST PUSH
   * ========================================
   *
   * POST /notifications/test
   *
   * Envía notificaciones solamente
   * a los dispositivos del usuario.
   */
  public testPush =
    async (
      _req: Request,
      res: Response
    ): Promise<Response> => {

      const ownerId =
        this.getOwnerId(res);

      if (!ownerId) {
        return res
          .status(401)
          .json({
            message: "Sesión requerida",
          });
      }

      try {
        const result =
          await this.sendTestPush
            .execute(ownerId);

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

  /*
   * ========================================
   * GET PUSH PREFERENCES
   * ========================================
   *
   * GET /notifications/preferences
   *
   * Recupera las preferencias
   * individuales del usuario.
   */
  public getPreferences =
    async (
      _req: Request,
      res: Response
    ): Promise<Response> => {

      const ownerId =
        this.getOwnerId(res);

      if (!ownerId) {
        return res
          .status(401)
          .json({
            message: "Sesión requerida",
          });
      }

      try {
        const preferences =
          await this.getPushPreferences
            .execute(ownerId);

        return res
          .status(200)
          .json({
            preferences,
          });

      } catch (error) {
        console.error(
          "[NotificationController.getPreferences]",
          error
        );

        return res
          .status(500)
          .json({
            message:
              "Could not retrieve push preferences",
          });
      }
    };

  /*
   * ========================================
   * UPDATE PUSH PREFERENCES
   * ========================================
   *
   * PATCH /notifications/preferences
   *
   * Modifica solamente las preferencias
   * del usuario autenticado.
   */
  public updatePreferences =
    async (
      req: Request,
      res: Response
    ): Promise<Response> => {

      const ownerId =
        this.getOwnerId(res);

      if (!ownerId) {
        return res
          .status(401)
          .json({
            message: "Sesión requerida",
          });
      }

      try {
        const {
          enabled,
          minimumStrength,
          watchlistTypes,
        } = req.body ?? {};

        /*
         * Validar enabled.
         */
        if (
          enabled !== undefined &&
          typeof enabled !== "boolean"
        ) {
          return res
            .status(400)
            .json({
              message:
                "enabled must be boolean",
            });
        }

        /*
         * Validar minimumStrength.
         */
        if (
          minimumStrength !== undefined &&
          minimumStrength !== "clear" &&
          minimumStrength !== "strong"
        ) {
          return res
            .status(400)
            .json({
              message:
                "minimumStrength must be clear or strong",
            });
        }

        /*
         * Actualizar únicamente las
         * preferencias del propietario.
         */
        const preferences =
          await this.updatePushPreferences
            .execute(
              {
                enabled,
                minimumStrength,
                watchlistTypes,
              },
              ownerId
            );

        return res
          .status(200)
          .json({
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
              error instanceof Error
                ? error.message
                : "Could not update push preferences",
          });
      }
    };
}

