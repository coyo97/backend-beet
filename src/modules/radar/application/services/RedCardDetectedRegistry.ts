import type {
  RedCardDetectedSignal,
} from "../../domain/entities/RedCardDetectedSignal";

interface RegistryEntry {
  fingerprint:
    string;

  lastSeenAt:
    number;
}

export class RedCardDetectedRegistry {
  private readonly entries =
    new Map<
      string,
      RegistryEntry
    >();

  constructor(
    private readonly ttlMs:
      number
  ) {}

  public shouldPublish(
    signal:
      RedCardDetectedSignal
  ): boolean {

    const now =
      Date.now();

    this.cleanup(
      now
    );

    const key =
      signal.id;

    const previous =
      this.entries.get(
        key
      );

    /*
     * Misma cantidad y mismo reparto
     * de tarjetas.
     */
    if (
      previous &&
      previous.fingerprint ===
        signal.fingerprint
    ) {

      previous.lastSeenAt =
        now;

      return false;
    }

    /*
     * Primera roja o una roja adicional.
     */
    this.entries.set(
      key,
      {
        fingerprint:
          signal.fingerprint,

        lastSeenAt:
          now,
      }
    );

    return true;
  }

  public size():
    number {

    return this.entries.size;
  }

  private cleanup(
    now:
      number
  ): void {

    for (
      const [
        key,
        entry,
      ]
      of this.entries
    ) {

      if (
        now -
          entry.lastSeenAt >
        this.ttlMs
      ) {

        this.entries.delete(
          key
        );
      }
    }
  }
}
