
import type {
  Request,
  Response,
} from "express";

import type {
  WatchlistItemType,
} from "../../domain/entities/WatchlistItem";

import type {
  CreateWatchlistItem,
} from "../../application/use-cases/CreateWatchlistItem";

import type {
  DeleteWatchlistItem,
} from "../../application/use-cases/DeleteWatchlistItem";

import type {
  GetWatchlist,
} from "../../application/use-cases/GetWatchlist";

import type {
  SetWatchlistEnabled,
} from "../../application/use-cases/SetWatchlistEnabled";

const WATCHLIST_ITEM_TYPES = [
  "match",
  "team",
  "competition",
  "country",
  "radar-rule",
] as const;

function isWatchlistItemType(
  value: unknown
): value is WatchlistItemType {

  return (
    typeof value ===
      "string" &&
    (
      WATCHLIST_ITEM_TYPES as
        readonly string[]
    ).includes(
      value
    )
  );
}

export class WatchlistController {
  constructor(
    private readonly createWatchlistItem:
      CreateWatchlistItem,

    private readonly getWatchlist:
      GetWatchlist,

    private readonly deleteWatchlistItem:
      DeleteWatchlistItem,

    private readonly setWatchlistEnabled:
      SetWatchlistEnabled
  ) {}

  /*
   * ========================================
   * AUTHENTICATED OWNER
   * ========================================
   *
   * El propietario se obtiene del JWT
   * verificado por requireAuth.
   *
   * Nunca se acepta el ownerId
   * proporcionado por el cliente.
   */
  private getOwnerId(
    res: Response
  ): string | null {

    const ownerId =
      res.locals.authUserId;

    return typeof ownerId ===
      "string"
      ? ownerId
      : null;
  }

  /*
   * ========================================
   * GET WATCHLIST
   * ========================================
   *
   * GET /watchlist
   *
   * Devuelve solamente las entradas
   * del usuario autenticado.
   */
  public list =
    async (
      _req: Request,
      res: Response
    ): Promise<Response> => {

      try {
        const ownerId =
          this.getOwnerId(res);

        if (!ownerId) {
          return res
            .status(401)
            .json({
              message:
                "Sesión requerida",
            });
        }

        const items =
          await this
            .getWatchlist
            .execute(
              ownerId
            );

        return res
          .status(200)
          .json({
            count:
              items.length,

            items,
          });
      } catch (error) {
        console.error(
          "[WatchlistController.list]",
          error
        );

        return res
          .status(500)
          .json({
            message:
              "Could not retrieve watchlist",
          });
      }
    };

  /*
   * ========================================
   * CREATE WATCHLIST ITEM
   * ========================================
   *
   * POST /watchlist
   *
   * El registro queda asociado
   * al usuario autenticado.
   */
  public create =
    async (
      req: Request,
      res: Response
    ): Promise<Response> => {

      try {
        const ownerId =
          this.getOwnerId(res);

        if (!ownerId) {
          return res
            .status(401)
            .json({
              message:
                "Sesión requerida",
            });
        }

        const {
          type,
          label,
          target,
          rule,
        } =
          req.body ?? {};

        if (
          typeof type !==
            "string" ||
          typeof label !==
            "string" ||
          !target ||
          typeof target !==
            "object"
        ) {
          return res
            .status(400)
            .json({
              message:
                "type, label and target are required",
            });
        }

        if (
          !isWatchlistItemType(
            type
          )
        ) {
          return res
            .status(400)
            .json({
              message:
                "Invalid watchlist type",
            });
        }

        const item =
          await this
            .createWatchlistItem
            .execute({
              ownerId,

              type,

              label,

              target,

              rule:
                rule ??
                null,
            });

        return res
          .status(200)
          .json({
            item,
          });
      } catch (error) {
        console.error(
          "[WatchlistController.create]",
          error
        );

        return res
          .status(400)
          .json({
            message:
              error instanceof Error
                ? error.message
                : "Could not create watchlist item",
          });
      }
    };

  /*
   * ========================================
   * DELETE WATCHLIST ITEM
   * ========================================
   *
   * DELETE /watchlist/:id
   *
   * Solo puede eliminar entradas
   * pertenecientes al usuario.
   */
  public remove =
    async (
      req: Request,
      res: Response
    ): Promise<Response> => {

      try {
        const ownerId =
          this.getOwnerId(res);

        if (!ownerId) {
          return res
            .status(401)
            .json({
              message:
                "Sesión requerida",
            });
        }

        const rawId =
          req.params.id;

        const id =
          Array.isArray(
            rawId
          )
            ? rawId[0]
            : rawId;

        if (!id) {
          return res
            .status(400)
            .json({
              message:
                "Watchlist id is required",
            });
        }

        const deleted =
          await this
            .deleteWatchlistItem
            .execute(
              id,
              ownerId
            );

        if (!deleted) {
          return res
            .status(404)
            .json({
              message:
                "Watchlist item not found",
            });
        }

        return res
          .status(200)
          .json({
            deleted:
              true,
          });
      } catch (error) {
        console.error(
          "[WatchlistController.remove]",
          error
        );

        return res
          .status(500)
          .json({
            message:
              "Could not delete watchlist item",
          });
      }
    };

  /*
   * ========================================
   * ENABLE / DISABLE WATCHLIST
   * ========================================
   *
   * PATCH /watchlist/:id/enabled
   *
   * Solo modifica entradas
   * del usuario autenticado.
   */
  public setEnabled =
    async (
      req: Request,
      res: Response
    ): Promise<Response> => {

      try {
        const ownerId =
          this.getOwnerId(res);

        if (!ownerId) {
          return res
            .status(401)
            .json({
              message:
                "Sesión requerida",
            });
        }

        const rawId =
          req.params.id;

        const id =
          Array.isArray(
            rawId
          )
            ? rawId[0]
            : rawId;

        if (!id) {
          return res
            .status(400)
            .json({
              message:
                "Watchlist id is required",
            });
        }

        const enabled =
          req.body?.enabled;

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

        const item =
          await this
            .setWatchlistEnabled
            .execute(
              id,
              enabled,
              ownerId
            );

        if (!item) {
          return res
            .status(404)
            .json({
              message:
                "Watchlist item not found",
            });
        }

        return res
          .status(200)
          .json({
            item,
          });
      } catch (error) {
        console.error(
          "[WatchlistController.setEnabled]",
          error
        );

        return res
          .status(500)
          .json({
            message:
              "Could not update watchlist item",
          });
      }
    };
}

