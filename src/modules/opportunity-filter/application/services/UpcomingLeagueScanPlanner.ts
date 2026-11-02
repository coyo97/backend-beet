
interface PlannedLeagueGroup {
  key: string;

  matches: readonly {
    kickoffAt: string;
  }[];
}

interface PriorityGroup<T> {
  group: T;
  distanceMs: number;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export class UpcomingLeagueScanPlanner {

  private cursor = 0;

  /*
   * Próxima fecha en la que una
   * liga puede volver a analizarse.
   */
  private readonly nextEligibleAt =
    new Map<string, number>();

  private readonly successCooldownMs =
    20 * MINUTE_MS;

  private readonly failureCooldownMs =
    5 * MINUTE_MS;

  /*
   * Se reservan como máximo
   * dos plazas para urgencias.
   *
   * Las demás quedan disponibles
   * para la rotación mundial.
   */
  private readonly maxPrioritySlots = 2;

  public select<
    T extends PlannedLeagueGroup
  >(
    groups: readonly T[],
    requestedLimit = 5,
    nowMs = Date.now()
  ): T[] {

    if (groups.length === 0) {
      this.cursor = 0;
      this.nextEligibleAt.clear();
      return [];
    }

    const limit = Math.min(
      5,
      Math.max(
        1,
        Math.trunc(requestedLimit)
      ),
      groups.length
    );

    const activeKeys =
      new Set(
        groups.map(group => group.key)
      );

    /*
     * Eliminar ligas que ya no
     * aparecen en el catálogo.
     */
    for (
      const key of this.nextEligibleAt.keys()
    ) {
      if (!activeKeys.has(key)) {
        this.nextEligibleAt.delete(key);
      }
    }

    const eligible = (
      group: T
    ): boolean => {

      return (
        this.nextEligibleAt.get(
          group.key
        ) ?? 0
      ) <= nowMs;
    };

    const nearOneHour:
      PriorityGroup<T>[] = [];

    const nearOneDay:
      PriorityGroup<T>[] = [];

    /*
     * Identificar ligas con
     * encuentros próximos a
     * las ventanas importantes.
     */
    for (const group of groups) {

      if (!eligible(group)) {
        continue;
      }

      let hourDistance =
        Number.POSITIVE_INFINITY;

      let dayDistance =
        Number.POSITIVE_INFINITY;

      for (const match of group.matches) {

        const remainingMs =
          Date.parse(
            match.kickoffAt
          ) - nowMs;

        if (
          !Number.isFinite(remainingMs) ||
          remainingMs <= 0
        ) {
          continue;
        }

        /*
         * Urgencia:
         * encuentro dentro de 2h.
         *
         * Se favorecen los más
         * cercanos a la marca
         * de 60 minutos.
         */
        if (
          remainingMs <=
          2 * HOUR_MS
        ) {
          hourDistance = Math.min(
            hourDistance,
            Math.abs(
              remainingMs - HOUR_MS
            )
          );
        }

        /*
         * Anticipación:
         * encuentros situados
         * entre 22 y 26 horas
         * del comienzo.
         */
        if (
          remainingMs >=
            22 * HOUR_MS &&
          remainingMs <=
            26 * HOUR_MS
        ) {
          dayDistance = Math.min(
            dayDistance,
            Math.abs(
              remainingMs -
              24 * HOUR_MS
            )
          );
        }
      }

      if (
        Number.isFinite(hourDistance)
      ) {
        nearOneHour.push({
          group,
          distanceMs: hourDistance,
        });

      } else if (
        Number.isFinite(dayDistance)
      ) {
        nearOneDay.push({
          group,
          distanceMs: dayDistance,
        });
      }
    }

    nearOneHour.sort(
      (a, b) =>
        a.distanceMs - b.distanceMs
    );

    nearOneDay.sort(
      (a, b) =>
        a.distanceMs - b.distanceMs
    );

    const selected: T[] = [];

    const selectedKeys =
      new Set<string>();

    const priorityLimit =
      Math.min(
        this.maxPrioritySlots,
        limit
      );

    const addPriority = (
      item: PriorityGroup<T> | undefined
    ): void => {

      if (!item) {
        return;
      }

      if (
        selected.length >= priorityLimit ||
        selectedKeys.has(
          item.group.key
        )
      ) {
        return;
      }

      selected.push(
        item.group
      );

      selectedKeys.add(
        item.group.key
      );
    };

    /*
     * Priorizar una liga próxima
     * a 60 minutos y otra próxima
     * a 24 horas, si existen.
     */
    addPriority(
      nearOneHour[0]
    );

    addPriority(
      nearOneDay[0]
    );

    /*
     * Si alguna ventana no tiene
     * ligas disponibles, utilizar
     * sus plazas libres.
     */
    for (
      const item of [
        ...nearOneHour,
        ...nearOneDay,
      ]
    ) {
      if (
        selected.length >=
        priorityLimit
      ) {
        break;
      }

      addPriority(item);
    }

    /*
     * ROTACIÓN MUNDIAL
     *
     * Las plazas restantes
     * recorren las demás ligas.
     */
    let index =
      this.cursor % groups.length;

    let inspected = 0;

    while (
      inspected < groups.length &&
      selected.length < limit
    ) {

      const group =
        groups[index];

      if (
        eligible(group) &&
        !selectedKeys.has(
          group.key
        )
      ) {
        selected.push(group);

        selectedKeys.add(
          group.key
        );
      }

      index =
        (index + 1) %
        groups.length;

      inspected++;
    }

    /*
     * La próxima ejecución
     * continúa desde aquí.
     */
    this.cursor = index;

    return selected;
  }

  public markCompleted(
    key: string,
    success: boolean,
    nowMs = Date.now()
  ): void {

    const cooldown =
      success
        ? this.successCooldownMs
        : this.failureCooldownMs;

    this.nextEligibleAt.set(
      key,
      nowMs + cooldown
    );
  }
}

