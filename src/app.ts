import express, {
  type Express,
} from "express";

import cors from "cors";
import helmet from "helmet";

import {
  createServer,
  type Server as HttpServer,
} from "http";

import type {
  Server as SocketIOServer,
} from "socket.io";

import {
  requireAuth,
} from "./modules/auth/presentation/middleware/requireAuth";

import {
  bindAuthenticatedOwner,
} from "./modules/auth/presentation/middleware/bindAuthenticatedOwner";

import {
  authRouter,
} from "./modules/auth/presentation/routes/authRoutes";

import {
  env,
} from "./config/env";

import {
  createApiRouter,
} from "./shared/infrastructure/http/routes";

import {
  SocketServer,
} from "./shared/infrastructure/socket/SocketServer";

export default class App {
  private readonly app:
    Express;

  private readonly httpServer:
    HttpServer;

  private readonly socketServer:
    SocketServer;

  constructor() {
    this.app =
      express();

    this.httpServer =
      createServer(
        this.app
      );

    this.socketServer =
      new SocketServer(
        this.httpServer
      );

    this.configureMiddlewares();

    this.configureRoutes();
  }

  private configureMiddlewares():
    void {

    this.app.use(
      helmet()
    );

    this.app.use(
      cors()
    );

    this.app.use(
      express.json()
    );

    this.app.use(
      express.urlencoded({
        extended: true,
      })
    );
  }

  private configureRoutes():
    void {

    const apiBase =
      `/${env.API_PREFIX}/${env.API_VERSION}`;

    /*
     * ========================================
     * AUTHENTICATION
     * ========================================
     *
     * POST /api/v1/auth/register
     * POST /api/v1/auth/login
     * GET  /api/v1/auth/me
     */
    this.app.use(
      `${apiBase}/auth`,
      authRouter
    );

    /*
     * ========================================
     * PRIVATE OWNER MIDDLEWARE
     * ========================================
     *
     * 1. Verifica el token JWT.
     *
     * 2. Obtiene el userId autenticado.
     *
     * 3. Vincula el ownerId al usuario
     *    identificado por el backend.
     *
     * Nunca confiamos en el ownerId
     * enviado directamente por el móvil.
     */
    const privateOwnerMiddleware = [
      requireAuth,
      bindAuthenticatedOwner,
    ];

    /*
     * ========================================
     * TEAM MEMORY PROTECTION
     * ========================================
     *
     * Protege todas las rutas que
     * comiencen con:
     *
     * /api/v1/team-memory
     *
     * Debe registrarse antes del
     * router general.
     */
    this.app.use(
      `${apiBase}/team-memory`,
      ...privateOwnerMiddleware
    );

    /*
     * ========================================
     * TEAM PROFILE PROTECTION
     * ========================================
     *
     * Protegemos también los perfiles
     * personales de equipos.
     */
    this.app.use(
      `${apiBase}/team-profile`,
      ...privateOwnerMiddleware
    );

    /*
     * ========================================
     * EXISTING API MODULES
     * ========================================
     *
     * Conservamos todos los módulos:
     *
     * - Football
     * - Radar
     * - Team Memory
     * - Team Profile
     * - Match Context
     * - Notifications
     * - Otros
     */
    const apiRouter =
      createApiRouter();

    this.app.use(
      apiBase,
      apiRouter
    );
  }

  public getExpressApp():
    Express {

    return this.app;
  }

  public getHttpServer():
    HttpServer {

    return this.httpServer;
  }

  public getSocketIO():
    SocketIOServer {

    return this.socketServer
      .getIO();
  }

  public getSocketServer():
    SocketServer {

    return this.socketServer;
  }
}
