
import type {
  WatchlistItem,
} from "../entities/WatchlistItem";

export interface CreateWatchlistRecord {
  ownerId: string;

  type: WatchlistItem["type"];

  label: string;

  dedupKey: string;

  enabled: boolean;

  target: WatchlistItem["target"];

  rule: WatchlistItem["rule"];
}

export interface WatchlistRepository {
  /*
   * Sin ownerId no se devuelve
   * información personal.
   *
   * Se mantiene opcional
   * temporalmente por el matcher
   * antiguo del Radar.
   */
  findAll(
    ownerId?: string
  ): Promise<WatchlistItem[]>;

  findById(
    id: string,
    ownerId?: string
  ): Promise<WatchlistItem | null>;

  /*
 * Usuarios que tienen entradas
 * activas en Watchlist.
 */
findActiveOwnerIds(): Promise<string[]>;

  findByDedupKey(
    dedupKey: string,
    ownerId?: string
  ): Promise<WatchlistItem | null>;

  create(
    input: CreateWatchlistRecord
  ): Promise<WatchlistItem>;

  deleteById(
    id: string,
    ownerId?: string
  ): Promise<boolean>;

  setEnabled(
    id: string,
    enabled: boolean,
    ownerId?: string
  ): Promise<WatchlistItem | null>;
}

