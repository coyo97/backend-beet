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

import { env } from "./config/env";

import {
  createApiRouter,
} from "./shared/infrastructure/http/routes";

import {
  SocketServer,
} from "./shared/infrastructure/socket/SocketServer";

export default class App {
  private readonly app: Express;

  private readonly httpServer:
    HttpServer;

  private readonly socketServer:
    SocketServer;

  constructor() {
    this.app = express();

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

  private configureMiddlewares(): void {
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

  private configureRoutes(): void {
    const apiRouter =
      createApiRouter();

    this.app.use(
      `/${env.API_PREFIX}/${env.API_VERSION}`,
      apiRouter
    );
  }

  public getExpressApp(): Express {
    return this.app;
  }

  public getHttpServer(): HttpServer {
    return this.httpServer;
  }

  public getSocketIO(): SocketIOServer {
    return this.socketServer.getIO();
  }
  public getSocketServer():
  SocketServer {

  return this.socketServer;
}
}
