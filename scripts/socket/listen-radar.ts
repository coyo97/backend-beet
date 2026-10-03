import {
  io,
} from "socket.io-client";

const url =
  process.env
    .RADAR_SOCKET_URL ??
  "http://127.0.0.1:8000";

console.log(
  `[RadarSocketClient] connecting to ${url}`
);

const socket =
  io(
    url,
    {
      transports: [
        "websocket",
        "polling",
      ],

      reconnection:
        true,

      reconnectionAttempts:
        Infinity,

      reconnectionDelay:
        1000,
    }
  );

socket.on(
  "connect",
  () => {
    console.log(
      "[RadarSocketClient] connected"
    );

    console.log(
      "socket id:",
      socket.id
    );
  }
);

socket.on(
  "disconnect",
  (reason) => {
    console.log(
      "[RadarSocketClient] disconnected:",
      reason
    );
  }
);

socket.on(
  "connect_error",
  (error) => {
    console.error(
      "[RadarSocketClient] connection error:",
      error.message
    );
  }
);

socket.on(
  "radar:red-card-pressure",
  (payload) => {

    console.log();
    console.log(
      "================================"
    );

    console.log(
      "🔴 RADAR SIGNAL"
    );

    console.log(
      JSON.stringify(
        payload,
        null,
        2
      )
    );

    console.log(
      "================================"
    );
    console.log();
  }
);
