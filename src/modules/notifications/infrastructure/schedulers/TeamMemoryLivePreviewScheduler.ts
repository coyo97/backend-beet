
import type {
  LiveMatch,
} from "../../../football/domain/entities/LiveMatch";

import type {
  OwnerTeamMemoryLiveAlert,
} from "../../application/services/FindTeamMemoryLiveAlerts";

interface LiveSnapshotReader {
  getFresh(
    maxAgeMs?: number,
    now?: Date
  ): LiveMatch[];

  getStats?(): {
    count: number;
    observedAt: string | null;
  };
}

interface TeamMemoryAlertFinder {
  execute(
    matches: readonly LiveMatch[],
    now?: Date
  ): Promise<OwnerTeamMemoryLiveAlert[]>;
}

export interface TeamMemoryPreviewReport {
  status:
    | "ok"
    | "no-fresh-matches"
    | "skipped-running";

  liveMatches: number;
  candidateAlerts: number;
  owners: number;
  sent: number;
}

interface TeamMemoryPreviewDispatcher {
  execute(
  alerts: readonly OwnerTeamMemoryLiveAlert[],
  options?: { send?: boolean }
): Promise<{
  optedInDevices: number;
  eligible: number;
  claimed: number;
  attempted: number;

  accepted: number;
  rejected: number;
  unknown: number;
}>;
}

export class TeamMemoryLivePreviewScheduler {

  private timer:
    NodeJS.Timeout | null = null;

  private running = false;
  private scanNumber = 0;

  constructor(
    private readonly snapshot:
      LiveSnapshotReader,

    private readonly finder:
      TeamMemoryAlertFinder,

    private readonly intervalMs =
      60_000,

    private readonly maxAgeMs =
      120_000,

	private readonly dispatcher?:
  TeamMemoryPreviewDispatcher
  ) {}

  public start(): void {

    /*
     * Apagado por defecto.
     */
    if (
      process.env
        .TEAM_MEMORY_LIVE_PREVIEW_ENABLED !==
      "true"
    ) {
      console.log(
        "[TeamMemoryLivePreview] disabled"
      );
      return;
    }

    if (this.timer) {
      return;
    }

    console.log(
      "[TeamMemoryLivePreview] started",
	  `mode=${
  process.env.TEAM_MEMORY_LIVE_SEND_ENABLED ===
  "true"
    ? "send"
    : "preview"
}`
    );

    /*
     * Primera revisión inmediata.
     */
    void this.runOnce().catch(
      error => {
        console.error(
          "[TeamMemoryLivePreview] scan failed",
          error
        );
      }
    );

    this.timer =
      setInterval(() => {
        void this.runOnce().catch(
          error => {
            console.error(
              "[TeamMemoryLivePreview] scan failed",
              error
            );
          }
        );
      }, this.intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async runOnce(
    now = new Date()
  ): Promise<TeamMemoryPreviewReport> {

    if (this.running) {
      return {
        status: "skipped-running",
        liveMatches: 0,
        candidateAlerts: 0,
        owners: 0,
        sent: 0,
      };
    }

    this.running = true;
    this.scanNumber++;

    const startedAt = Date.now();

    try {
      /*
       * Únicamente datos que YA
       * fueron obtenidos por
       * GetLiveMatches.
       */
      const matches =
        this.snapshot.getFresh(
          this.maxAgeMs,
          now
        );

      if (matches.length === 0) {

        const report: TeamMemoryPreviewReport = {
          status: "no-fresh-matches",
          liveMatches: 0,
          candidateAlerts: 0,
          owners: 0,
          sent: 0,
        };


/*
 * Diagnóstico del almacenamiento:
 *
 * never-observed:
 *   nadie obtuvo partidos Live todavía.
 *
 * stale:
 *   la última actualización venció.
 *
 * empty-live:
 *   se consultaron partidos, pero
 *   la lista actual está vacía.
 */
const snapshotStats =
  this.snapshot.getStats?.();

const observedAt =
  snapshotStats?.observedAt ?? null;

const ageMs =
  observedAt !== null
    ? now.getTime() -
      Date.parse(observedAt)
    : null;

let snapshotState =
  "never-observed";

if (ageMs !== null) {

  if (!Number.isFinite(ageMs)) {
    snapshotState = "invalid-date";

  } else if (ageMs < 0) {
    snapshotState = "clock-skew";

  } else if (ageMs > this.maxAgeMs) {
    snapshotState = "stale";

  } else {
    snapshotState = "empty-live";
  }
}



console.log(
  [
    "[TeamMemoryLivePreview]",
    `scan=${this.scanNumber}`,
    "freshMatches=0",
    `snapshot=${snapshotState}`,
    `cached=${snapshotStats?.count ?? 0}`,
    `ageMs=${ageMs ?? "none"}`,
    "candidates=0",
    "owners=0",
    "sent=0",
  ].join(" ")
);


        return report;
      }

      /*
       * Finder:
       * - selecciona partidos recientes
       * - consulta Team Memory en MongoDB
       * - separa propietarios
       * - construye mensajes
       *
       * No envía ningún mensaje.
       */
      const alerts =
        await this.finder.execute(
          matches,
          now
        );

/*
 * El scheduler puede solicitar envíos.
 * El despachador mantiene su propia
 * autorización independiente.
 */
const sendRequested =
  process.env.TEAM_MEMORY_LIVE_SEND_ENABLED ===
  "true";

const dispatch =
  this.dispatcher
    ? await this.dispatcher.execute(
        alerts,
        {
          send: sendRequested,
        }
      )
    : null;

      const ownerIds =
        new Set(
          alerts.map(
            alert => alert.ownerId
          )
        );

const report: TeamMemoryPreviewReport = {
  status: "ok",
  liveMatches: matches.length,
  candidateAlerts: alerts.length,
  owners: ownerIds.size,

  /*
   * Mensajes inicialmente aceptados
   * por Expo, no entrega confirmada
   * por Android.
   */
  sent: dispatch?.accepted ?? 0,
};

      /*
       * No registrar información
       * personal, tokens ni detalles
       * de apuestas en logs.
       */
      console.log(
        [
          "[TeamMemoryLivePreview]",
          `scan=${this.scanNumber}`,
          `freshMatches=${report.liveMatches}`,
          `candidates=${report.candidateAlerts}`,
`owners=${report.owners}`,
`optedIn=${dispatch?.optedInDevices ?? 0}`,
`eligible=${dispatch?.eligible ?? 0}`,
`claimed=${dispatch?.claimed ?? 0}`,
`sendRequested=${sendRequested}`,
`attempted=${dispatch?.attempted ?? 0}`,
`accepted=${dispatch?.accepted ?? 0}`,
`rejected=${dispatch?.rejected ?? 0}`,
`unknown=${dispatch?.unknown ?? 0}`,
          `duration=${Date.now() - startedAt}ms`,
        ].join(" ")
      );

      return report;

    } finally {
      this.running = false;
    }
  }
}

