import type { Server as HttpServer } from "http";

import {
  Server as SocketIOServer,
} from "socket.io";

export class SocketServer {
  private readonly io: SocketIOServer;

  constructor(
    httpServer: HttpServer
  ) {
    this.io =
      new SocketIOServer(
        httpServer,
        {
          cors: {
            origin: "*",
            methods: [
              "GET",
              "POST",
            ],
          },
        }
      );

    this.configure();
  }

  private configure(): void {
    this.io.on(
      "connection",
      (socket) => {
        console.log(
          `Socket connected: ${socket.id}`
        );

        socket.on(
          "disconnect",
          () => {
            console.log(
              `Socket disconnected: ${socket.id}`
            );
          }
        );
      }
    );
  }

  public getIO(): SocketIOServer {
    return this.io;
  }

  public emit(
  event: string,
  payload: unknown
): void {
  this.io.emit(
    event,
    payload
  );
}
}		
