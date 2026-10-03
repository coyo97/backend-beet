import type {
  RedCardPressureSignal,
} from "../../domain/entities/RedCardPressureSignal";

interface RegistryEntry {
  fingerprint: string;

  lastSeenAt:
    number;
}

export class SignalRegistry {
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
      RedCardPressureSignal
  ): boolean {

    const now =
      Date.now();

    this.cleanup(
      now
    );

    const matchKey =
      this.buildMatchKey(
        signal
      );

    const fingerprint =
      this.buildFingerprint(
        signal
      );

    const previous =
      this.entries.get(
        matchKey
      );

    /*
     * Seguimos viendo la misma
     * señal, por lo que refrescamos
     * lastSeenAt para que no expire
     * mientras siga activa.
     */
    if (
      previous &&
      previous.fingerprint ===
        fingerprint
    ) {
      previous.lastSeenAt =
        now;

      return false;
    }

    /*
     * Primera señal o cambio
     * importante en la existente.
     */
    this.entries.set(
      matchKey,
      {
        fingerprint,
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

  private buildMatchKey(
    signal:
      RedCardPressureSignal
  ): string {

    /*
     * Preferimos Flashscore
     * porque actualmente es nuestro
     * proveedor live principal.
     */
    const preferred =
  signal.match.sources.find(
    (
      source
    ) =>
      source.provider ===
      "flashscore"
  ) ??
  signal.match.sources.find(
    (
      source
    ) =>
      source.provider ===
      "fotmob"
  ) ??
  signal.match.sources.find(
    (
      source
    ) =>
      source.provider ===
      "api-football"
  ) ??
  signal.match.sources.find(
    (
      source
    ) =>
      source.provider ===
      "bookmaker"
  ) ??
  signal.match.sources[0];

    if (preferred) {
      return [
        preferred.provider,
        preferred.externalId,
        signal.type,
      ].join(":");
    }

    /*
     * Fallback extremadamente raro.
     */
    return [
      signal.match.home.name,
      signal.match.away.name,
      signal.match.kickoffAt,
      signal.type,
    ].join(":");
  }

  private buildFingerprint(
    signal:
      RedCardPressureSignal
  ): string {

    /*
     * No usamos el pressure score
     * exacto porque cambia
     * continuamente.
     *
     * Sí notificamos nuevamente si:
     *
     * - aparece otra roja,
     * - cambia el lado en desventaja,
     * - clear pasa a strong.
     */

    return [
      signal.redCards.home,
      signal.redCards.away,
      signal.disadvantagedSide,
      signal.advantagedSide,
      signal.strength,
    ].join(":");
  }

  private cleanup(
    now: number
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
