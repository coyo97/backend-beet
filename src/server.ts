import "./bootstrap/polyfills";
import "dotenv/config";

import App from "./app";

import {
  env,
} from "./config/env";

import {
  createRadarScheduler,
  createRedCardDetectedScheduler,
} from "./modules/radar/radarModule";

import {
  createPushReceiptScheduler,
} from "./modules/notifications/notificationModule";

import {
  connectDatabase,
  disconnectDatabase,
} from "./shared/infrastructure/database/mongoose";

async function bootstrap():
  Promise<void> {

  try {

    /*
     * 1. MongoDB
     */
    await connectDatabase();

    /*
     * 2. Aplicación HTTP + Socket.IO
     */
    const app =
      new App();

    const server =
      app.getHttpServer();

    const socketServer =
      app.getSocketServer();

    /*
     * 3. Schedulers
     *
     * Los dos radares utilizan
     * exactamente la misma instancia
     * de SocketServer.
     */
    const radarScheduler =
      createRadarScheduler(
        socketServer
      );

    const redCardDetectedScheduler =
      createRedCardDetectedScheduler(
        socketServer
      );

    const pushReceiptScheduler =
      createPushReceiptScheduler();

    let shuttingDown =
      false;

    /*
     * 4. HTTP server
     */
    server.listen(
      env.PORT,

      () => {

        console.log(
          "Football Radar API running"
        );

        console.log(
          `http://localhost:${env.PORT}`
        );

        console.log(
          `Environment: ${env.NODE_ENV}`
        );

        /*
         * Los schedulers arrancan
         * solamente después de que
         * HTTP + Socket.IO estén listos.
         */
        radarScheduler
          .start();

        redCardDetectedScheduler
          .start();

        pushReceiptScheduler
          .start();

        console.log(
          "[Schedulers] started"
        );
      }
    );

    /*
     * 5. Shutdown seguro
     */
    const shutdown =
      async (
        signal:
          string
      ): Promise<void> => {

        if (
          shuttingDown
        ) {
          return;
        }

        shuttingDown =
          true;

        console.log(
          `${signal} received`
        );

        console.log(
          "Shutting down..."
        );

        /*
         * Primero detenemos trabajos
         * periódicos para impedir
         * nuevos scans.
         */
        radarScheduler
          .stop();

        redCardDetectedScheduler
          .stop();

        pushReceiptScheduler
          .stop();

        /*
         * Después cerramos HTTP.
         */
        server.close(
          async (
            error?
          ) => {

            try {

              if (
                error
              ) {

                console.error(
                  "HTTP server close error:",
                  error
                );
              }

              /*
               * Finalmente MongoDB.
               */
              await disconnectDatabase();

              console.log(
                "MongoDB disconnected"
              );

              console.log(
                "Football Radar stopped"
              );

              process.exit(
                error
                  ? 1
                  : 0
              );

            } catch (
              disconnectError
            ) {

              console.error(
                "Error during shutdown:",
                disconnectError
              );

              process.exit(
                1
              );
            }
          }
        );
      };

    /*
     * Ctrl+C
     */
    process.on(
      "SIGINT",

      () => {
        void shutdown(
          "SIGINT"
        );
      }
    );

    /*
     * systemd / docker / kill
     */
    process.on(
      "SIGTERM",

      () => {
        void shutdown(
          "SIGTERM"
        );
      }
    );

  } catch (
    error
  ) {

    console.error(
      "Application failed to start:",
      error
    );

    process.exit(
      1
    );
  }
}

void bootstrap();
