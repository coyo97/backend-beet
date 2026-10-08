import type {
  Server as HttpServer,
} from "http";

import {
  Server as SocketIOServer,
} from "socket.io";

import jwt from "jsonwebtoken";

import {
  env,
} from "../../../config/env";

export class SocketServer {
  private readonly io:
    SocketIOServer;

  constructor(
    httpServer:
      HttpServer
  ) {
    this.io =
      new SocketIOServer(
        httpServer,
        {
          cors: {
            origin:
              "*",

            methods: [
              "GET",
              "POST",
            ],
          },
        }
      );

    this.configureAuthentication();

    this.configure();
  }

  /*
   * ========================================
   * AUTHENTICATION
   * ========================================
   *
   * El móvil utiliza exactamente el mismo
   * JWT que usa para la API REST.
   *
   * socket.handshake.auth.token
   */

  private configureAuthentication():
    void {

    this.io.use(
      (
        socket,
        next
      ) => {
        const token =
          socket.handshake
            .auth
            ?.token;

        if (
          typeof token !==
            "string" ||
          !token
        ) {
          next(
            new Error(
              "AUTH_REQUIRED"
            )
          );

          return;
        }

        try {
          const payload =
            jwt.verify(
              token,
              env.AUTH_JWT_SECRET,
              {
                algorithms: [
                  "HS256",
                ],

                issuer:
                  "football-radar",

                audience:
                  "football-radar-mobile",
              }
            );

          if (
            typeof payload ===
              "string" ||
            typeof payload.sub !==
              "string" ||
            !payload.sub
          ) {
            next(
              new Error(
                "INVALID_TOKEN"
              )
            );

            return;
          }

          /*
           * Guardamos la identidad
           * autenticada en el socket.
           *
           * Nunca aceptaremos un userId
           * enviado por el cliente.
           */
          socket.data
            .authUserId =
            payload.sub;

          next();
        } catch {
          next(
            new Error(
              "INVALID_TOKEN"
            )
          );
        }
      }
    );
  }

  /*
   * ========================================
   * CONNECTIONS
   * ========================================
   */

  private configure():
    void {

    this.io.on(
      "connection",
      async (
        socket
      ) => {
        const userId =
          socket.data
            .authUserId as
            | string
            | undefined;

        if (!userId) {
          socket.disconnect(
            true
          );

          return;
        }

        /*
         * Cada usuario tiene una sala privada.
         *
         * Si inicia sesión en dos teléfonos,
         * ambos sockets estarán en:
         *
         * user:<userId>
         */
        const room =
          this.getUserRoom(
            userId
          );

        await socket.join(
          room
        );

        console.log(
          `[Socket] connected user=${userId} socket=${socket.id}`
        );

        console.log(
          `[Socket] joined ${room}`
        );

        socket.on(
          "disconnect",
          (
            reason
          ) => {
            console.log(
              `[Socket] disconnected user=${userId} socket=${socket.id} reason=${reason}`
            );
          }
        );
      }
    );
  }

  /*
   * ========================================
   * USER ROOM
   * ========================================
   */

  private getUserRoom(
    userId:
      string
  ): string {

    return (
      `user:${userId}`
    );
  }

  /*
   * ========================================
   * PUBLIC / GLOBAL EVENTS
   * ========================================
   *
   * Conservamos esto porque los eventos
   * existentes de Radar pueden seguir
   * necesitándolo.
   */

  public emit(
    event:
      string,

    payload:
      unknown
  ): void {

    this.io.emit(
      event,
      payload
    );
  }

  /*
   * ========================================
   * PRIVATE USER EVENTS
   * ========================================
   *
   * Se usa para:
   *
   * - compartidos familiares
   * - eventos privados futuros
   *
   * Nunca recibe IDs del móvil.
   * Los userIds vienen del backend.
   */

  public emitToUsers(
    userIds:
      string[],

    event:
      string,

    payload:
      unknown
  ): void {

    const uniqueUserIds =
      Array.from(
        new Set(
          userIds
            .map(
              userId =>
                userId.trim()
            )
            .filter(
              Boolean
            )
        )
      );

    for (
      const userId
      of uniqueUserIds
    ) {
      this.io
        .to(
          this.getUserRoom(
            userId
          )
        )
        .emit(
          event,
          payload
        );
    }
  }

  public getIO():
    SocketIOServer {

    return this.io;
  }
}		
