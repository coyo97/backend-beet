import {
  Router,
} from "express";

import {
  z,
} from "zod";

import {
  requireAuth,
} from "../../../auth/presentation/middleware/requireAuth";

import {
  SharingService,
} from "../../application/services/SharingService";

import type {
  SocketServer,
} from "../../../../shared/infrastructure/socket/SocketServer";

/*
 * ========================================
 * VALIDATION SCHEMAS
 * ========================================
 */

const groupSchema =
  z.object({
    name:
      z.string()
        .trim()
        .max(50)
        .optional(),
  });

const joinSchema =
  z.object({
    inviteCode:
      z.string()
        .trim()
        .min(4)
        .max(20),
  });

const shareSchema =
  z.object({
    /*
     * share:
     *   solo compartir el partido.
     *
     * leaning:
     *   "voy con este equipo".
     *
     * bet:
     *   "aposté por este equipo".
     */
    action:
      z.enum([
        "share",
        "leaning",
        "bet",
      ]),

    /*
     * Opcional porque:
     *
     * action = share
     * no necesita seleccionar equipo.
     */
    selectedSide:
      z.enum([
        "home",
        "away",
      ])
        .nullable()
        .optional(),

    /*
     * Totalmente opcional.
     *
     * Compartir debe ser rápido.
     */
    note:
      z.string()
        .trim()
        .max(160)
        .nullable()
        .optional(),

    match:
      z.object({
        /*
         * Conservamos todas las fuentes
         * conocidas del partido.
         *
         * No hacemos ninguna petición
         * adicional a los proveedores.
         */
        sources:
          z.array(
            z.object({
              provider:
                z.string()
                  .trim()
                  .min(1)
                  .max(50),

              externalId:
                z.string()
                  .trim()
                  .min(1)
                  .max(100),
            })
          )
            .min(1),

        kickoffAt:
          z.string()
            .min(1),

        competitionName:
          z.string()
            .trim()
            .max(150)
            .nullable()
            .optional(),

        country:
          z.string()
            .trim()
            .max(80)
            .nullable()
            .optional(),

        homeName:
          z.string()
            .trim()
            .min(1)
            .max(120),

        awayName:
          z.string()
            .trim()
            .min(1)
            .max(120),

        homeGoals:
          z.number()
            .nullable()
            .optional(),

        awayGoals:
          z.number()
            .nullable()
            .optional(),

        minute:
          z.number()
            .int()
            .nullable()
            .optional(),
      }),
  });

/*
 * ========================================
 * ROUTER FACTORY
 * ========================================
 *
 * Recibimos SocketServer desde App.
 *
 * Así no usamos variables globales
 * y podemos emitir eventos privados
 * cuando alguien comparte un partido.
 */

export function createSharingRouter(
  socketServer:
    SocketServer
): Router {

  const router =
    Router();

  const service =
    new SharingService();

  /*
   * ========================================
   * AUTHENTICATION
   * ========================================
   *
   * Todas las rutas del módulo Sharing
   * requieren usuario autenticado.
   */
  router.use(
    requireAuth
  );

  /*
   * ========================================
   * GET MY GROUP
   * ========================================
   *
   * GET /api/v1/sharing/group
   */

  router.get(
    "/group",
    async (
      req,
      res
    ) => {
      try {
        const group =
          await service
            .getMyGroup(
              res.locals
                .authUserId
            );

        return res.json({
          group:
            group ??
            null,
        });
      } catch (error) {
        console.error(
          "[Sharing.group]",
          error
        );

        return res
          .status(500)
          .json({
            message:
              "No se pudo obtener el grupo",
          });
      }
    }
  );

  /*
   * ========================================
   * CREATE GROUP
   * ========================================
   *
   * POST /api/v1/sharing/group
   */

  router.post(
    "/group",
    async (
      req,
      res
    ) => {
      const parsed =
        groupSchema.safeParse(
          req.body
        );

      if (
        !parsed.success
      ) {
        return res
          .status(400)
          .json({
            message:
              "Datos inválidos",
          });
      }

      try {
        const group =
          await service
            .createGroup(
              res.locals
                .authUserId,

              parsed.data
                .name ??
                "Hermanos"
            );

        return res
          .status(201)
          .json({
            group,
          });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message ===
            "ALREADY_IN_GROUP"
        ) {
          return res
            .status(409)
            .json({
              message:
                "Ya perteneces a un grupo",
            });
        }

        console.error(
          "[Sharing.createGroup]",
          error
        );

        return res
          .status(500)
          .json({
            message:
              "No se pudo crear el grupo",
          });
      }
    }
  );

  /*
   * ========================================
   * JOIN GROUP
   * ========================================
   *
   * POST /api/v1/sharing/group/join
   */

  router.post(
    "/group/join",
    async (
      req,
      res
    ) => {
      const parsed =
        joinSchema.safeParse(
          req.body
        );

      if (
        !parsed.success
      ) {
        return res
          .status(400)
          .json({
            message:
              "Código inválido",
          });
      }

      try {
        const group =
          await service
            .joinGroup(
              res.locals
                .authUserId,

              parsed.data
                .inviteCode
            );

        return res.json({
          group,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message ===
            "GROUP_NOT_FOUND"
        ) {
          return res
            .status(404)
            .json({
              message:
                "Grupo no encontrado",
            });
        }

        if (
          error instanceof Error &&
          error.message ===
            "ALREADY_IN_GROUP"
        ) {
          return res
            .status(409)
            .json({
              message:
                "Ya perteneces a un grupo",
            });
        }

        console.error(
          "[Sharing.joinGroup]",
          error
        );

        return res
          .status(500)
          .json({
            message:
              "No se pudo unir al grupo",
          });
      }
    }
  );

  /*
   * ========================================
   * RECENT SHARED MATCHES
   * ========================================
   *
   * GET /api/v1/sharing/matches
   */

  router.get(
    "/matches",
    async (
      req,
      res
    ) => {
      try {
        const items =
          await service
            .getRecent(
              res.locals
                .authUserId
            );

        return res.json({
          count:
            items.length,

          items,
        });
      } catch (error) {
        console.error(
          "[Sharing.matches]",
          error
        );

        return res
          .status(500)
          .json({
            message:
              "No se pudieron obtener los compartidos",
          });
      }
    }
  );

  /*
   * ========================================
   * SHARE MATCH
   * ========================================
   *
   * POST /api/v1/sharing/matches
   *
   * Flujo:
   *
   * móvil
   *   ↓
   * REST
   *   ↓
   * MongoDB
   *   ↓
   * miembros del grupo
   *   ↓
   * Socket.IO privado
   */

  router.post(
    "/matches",
    async (
      req,
      res
    ) => {
      const parsed =
        shareSchema.safeParse(
          req.body
        );

      if (
        !parsed.success
      ) {
        return res
          .status(400)
          .json({
            message:
              "Compartido inválido",

            errors:
              parsed.error
                .flatten()
                .fieldErrors,
          });
      }

      try {
        /*
         * SharingService devuelve:
         *
         * {
         *   insight,
         *   memberIds
         * }
         *
         * memberIds nunca viene
         * desde el móvil.
         */
        const result =
          await service
            .shareMatch(
              res.locals
                .authUserId,

              {
                action:
                  parsed.data
                    .action,

                selectedSide:
                  parsed.data
                    .selectedSide ??
                  null,

                note:
                  parsed.data
                    .note ??
                  null,

                match: {
                  sources:
                    parsed.data
                      .match
                      .sources,

                  kickoffAt:
                    parsed.data
                      .match
                      .kickoffAt,

                  competitionName:
                    parsed.data
                      .match
                      .competitionName ??
                    null,

                  country:
                    parsed.data
                      .match
                      .country ??
                    null,

                  homeName:
                    parsed.data
                      .match
                      .homeName,

                  awayName:
                    parsed.data
                      .match
                      .awayName,

                  homeGoals:
                    parsed.data
                      .match
                      .homeGoals ??
                    null,

                  awayGoals:
                    parsed.data
                      .match
                      .awayGoals ??
                    null,

                  minute:
                    parsed.data
                      .match
                      .minute ??
                    null,
                },
              }
            );

        /*
         * ========================================
         * REALTIME PAYLOAD
         * ========================================
         *
         * Convertimos el documento de
         * Mongoose a un objeto normal.
         */

        const insight =
          result.insight
            .toObject();

        /*
         * Agregamos información mínima
         * del usuario que compartió.
         *
         * No necesitamos consultar Mongo
         * otra vez porque requireAuth
         * ya dejó username y userId.
         */
        const realtimePayload = {
          ...insight,

          createdByUser: {
            id:
              res.locals
                .authUserId,

            username:
              res.locals
                .authUsername ??
              "Usuario",
          },
        };

        /*
         * ========================================
         * PRIVATE SOCKET EVENT
         * ========================================
         *
         * Se envía únicamente a los
         * miembros reales del grupo.
         *
         * Cada miembro tiene una sala:
         *
         * user:<userId>
         */

const recipientIds =
  result.memberIds.filter(
    memberId =>
      memberId !==
      res.locals.authUserId
  );

socketServer.emitToUsers(
  recipientIds,

  "sharing:match",

  realtimePayload
);

        /*
         * El mismo payload vuelve al
         * móvil que realizó el POST.
         *
         * Cuando creemos el store móvil,
         * deduplicaremos por _id porque
         * ese mismo dispositivo también
         * puede recibir el evento Socket.
         */

        return res
          .status(201)
          .json({
            insight:
              realtimePayload,
          });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message ===
            "NO_GROUP"
        ) {
          return res
            .status(409)
            .json({
              message:
                "Primero debes crear o unirte a un grupo",
            });
        }

        if (
          error instanceof Error &&
          error.message ===
            "SIDE_REQUIRED"
        ) {
          return res
            .status(400)
            .json({
              message:
                "Debes seleccionar un equipo",
            });
        }

        console.error(
          "[Sharing.shareMatch]",
          error
        );

        return res
          .status(500)
          .json({
            message:
              "No se pudo compartir el partido",
          });
      }
    }
  );

  /*
   * ========================================
   * RETURN ROUTER
   * ========================================
   */

  return router;
};
