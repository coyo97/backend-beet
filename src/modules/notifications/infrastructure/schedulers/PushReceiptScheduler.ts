import type {
  ProcessPushReceipts,
} from "../../application/use-cases/ProcessPushReceipts";

export class PushReceiptScheduler {
  private timer:
    ReturnType<
      typeof setInterval
    > |
    null =
      null;

  private running =
    false;

  constructor(
    private readonly processReceipts:
      ProcessPushReceipts,

    private readonly intervalMs =
      5 *
      60 *
      1000
  ) {}

  public start():
    void {

    if (
      this.timer
    ) {
      return;
    }

    console.log(
      "[PushReceiptScheduler]",
      "started",
      `${this.intervalMs}ms`
    );

    void this.tick();

    this.timer =
      setInterval(
        () => {
          void this.tick();
        },
        this.intervalMs
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
      "[PushReceiptScheduler]",
      "stopped"
    );
  }

  private async tick():
    Promise<void> {

    if (
      this.running
    ) {
      return;
    }

    this.running =
      true;

    try {
      const result =
        await this
          .processReceipts
          .execute();

      if (
        result.scanned >
        0
      ) {
        console.log(
          "[PushReceipts]",
          result
        );
      }
    } catch (error) {
      console.error(
        "[PushReceiptScheduler]",
        error
      );
    } finally {
      this.running =
        false;
    }
  }
}
