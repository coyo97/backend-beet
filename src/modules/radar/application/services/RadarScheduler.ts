import type {
  GetRedCardPressureSignals,
} from "../use-cases/GetRedCardPressureSignals";

import type {
  RadarSignalPublisher,
} from "../ports/RadarSignalPublisher";

import {
  SignalRegistry,
} from "./SignalRegistry";

export interface RadarSchedulerOptions {
  intervalMs:
    number;
}

export class RadarScheduler {
  private timer:
    NodeJS.Timeout |
    null = null;

  private running =
    false;

  private scanNumber =
    0;

  constructor(
    private readonly getSignals:
      GetRedCardPressureSignals,

    private readonly registry:
      SignalRegistry,

    private readonly publisher:
      RadarSignalPublisher,

    private readonly options:
      RadarSchedulerOptions
  ) {}

  public start():
    void {

    if (this.timer) {
      return;
    }

    console.log(
      `[RadarScheduler] started (${this.options.intervalMs} ms)`
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

    if (!this.timer) {
      return;
    }

    clearInterval(
      this.timer
    );

    this.timer =
      null;

    console.log(
      "[RadarScheduler] stopped"
    );
  }

  private async tick():
    Promise<void> {

    /*
     * Si el scraper tarda más que
     * el intervalo, no solapamos
     * dos escaneos.
     */
    if (this.running) {
      console.warn(
        "[RadarScheduler] previous scan still running; skipping"
      );

      return;
    }

    this.running =
      true;

    this.scanNumber++;

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

        published++;
      }

      const duration =
        Date.now() -
        startedAt;

      console.log(
        [
          "[RadarScheduler]",
          `scan=${this.scanNumber}`,
          `signals=${signals.length}`,
          `published=${published}`,
          `registry=${this.registry.size()}`,
          `duration=${duration}ms`,
        ].join(" ")
      );
    } catch (error) {
      console.error(
        "[RadarScheduler] scan failed",
        error
      );
    } finally {
      this.running =
        false;
    }
  }
}
