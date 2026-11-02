
import type {
  LiveMatch,
} from "../../domain/entities/LiveMatch";

export class LiveMatchesSnapshotStore {

  private matches:
    LiveMatch[] = [];

  private observedAt:
    number | null = null;

  /*
   * Recibir los partidos que
   * un flujo del backend YA
   * consultó al proveedor.
   *
   * No realiza peticiones HTTP.
   */
  public observe(
    matches: readonly LiveMatch[],
    now = new Date()
  ): void {

    const timestamp =
      now.getTime();

    if (!Number.isFinite(timestamp)) {
      throw new Error(
        "Invalid observation date"
      );
    }

    this.matches =
      [...matches];

    this.observedAt =
      timestamp;
  }

  /*
   * Solo utilizar información
   * suficientemente reciente.
   *
   * Si el backend deja de
   * actualizar los partidos,
   * no devolver datos antiguos
   * como si fueran actuales.
   */
  public getFresh(
    maxAgeMs = 120_000,
    now = new Date()
  ): LiveMatch[] {

    if (this.observedAt === null) {
      return [];
    }

    const age =
      now.getTime() -
      this.observedAt;

    if (
      !Number.isFinite(age) ||
      age < 0 ||
      age > maxAgeMs
    ) {
      return [];
    }

    return [...this.matches];
  }

  public getStats(): {
    count: number;
    observedAt: string | null;
  } {

    return {
      count:
        this.matches.length,

      observedAt:
        this.observedAt === null
          ? null
          : new Date(
              this.observedAt
            ).toISOString(),
    };
  }
}

/*
 * Instancia compartida por
 * los módulos del mismo
 * proceso Node.js.
 */
export const liveMatchesSnapshotStore =
  new LiveMatchesSnapshotStore();

