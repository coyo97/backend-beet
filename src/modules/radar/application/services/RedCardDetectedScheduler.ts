import type {
  GetRedCardDetectedSignals,
} from "../use-cases/GetRedCardDetectedSignals";

import type {
  RedCardDetectedPublisher,
} from "../ports/RedCardDetectedPublisher";

import {
  RedCardDetectedRegistry,
} from "./RedCardDetectedRegistry";

export interface RedCardDetectedSchedulerOptions {
  intervalMs:
    number;
}

export class RedCardDetectedScheduler {
  private timer:
    NodeJS.Timeout |
    null =
      null;

  private running =
    false;

  private scanNumber =
    0;

  constructor(
    private readonly getSignals:
      GetRedCardDetectedSignals,

    private readonly registry:
      RedCardDetectedRegistry,

    private readonly publisher:
      RedCardDetectedPublisher,

    private readonly options:
      RedCardDetectedSchedulerOptions
  ) {}

  public start():
    void {

    if (
      this.timer
    ) {
      return;
    }

    console.log(
      `[RedCardDetectedScheduler] started (${this.options.intervalMs} ms)`
    );

    /*
     * Primera ejecución inmediata.
     */
    void this.tick();

    this.timer =
      setInterval(
        () => {
          void this.tick();
        },

        this.options
          .intervalMs
      );
  }

  public stop():
    void {

    if (
      !this.timer
    ) {
      return;
    }

    clearInterval(
      this.timer
    );

    this.timer =
      null;

    console.log(
      "[RedCardDetectedScheduler] stopped"
    );
  }

  private async tick():
    Promise<void> {

    /*
     * Igual que el scheduler original:
     * no solapar escaneos.
     */
    if (
      this.running
    ) {

      console.warn(
        "[RedCardDetectedScheduler] previous scan still running; skipping"
      );

      return;
    }

    this.running =
      true;

    this.scanNumber +=
      1;

    const startedAt =
      Date.now();

    try {

      const signals =
        await this
          .getSignals
          .execute();

      let published =
        0;

      for (
        const signal
        of signals
      ) {

        if (
          !this.registry
            .shouldPublish(
              signal
            )
        ) {
          continue;
        }

        await this
          .publisher
          .publish(
            signal
          );

        published +=
          1;
      }

      const duration =
        Date.now() -
        startedAt;

      console.log(
        [
          "[RedCardDetectedScheduler]",
          `scan=${this.scanNumber}`,
          `signals=${signals.length}`,
          `published=${published}`,
          `registry=${this.registry.size()}`,
          `duration=${duration}ms`,
        ].join(
          " "
        )
      );

    } catch (
      error
    ) {

      console.error(
        "[RedCardDetectedScheduler] scan failed",
        error
      );

    } finally {

      this.running =
        false;
    }
  }
}
