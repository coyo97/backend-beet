import type {
  WatchlistItem,
} from "../entities/WatchlistItem";

export interface CreateWatchlistRecord {
  type:
    WatchlistItem["type"];

  label:
    string;

  dedupKey:
    string;

  enabled:
    boolean;

  target:
    WatchlistItem["target"];

  rule:
    WatchlistItem["rule"];
}

export interface WatchlistRepository {
  findAll():
    Promise<
      WatchlistItem[]
    >;

  findById(
    id: string
  ):
    Promise<
      WatchlistItem | null
    >;

  findByDedupKey(
    dedupKey: string
  ):
    Promise<
      WatchlistItem | null
    >;

  create(
    input:
      CreateWatchlistRecord
  ):
    Promise<
      WatchlistItem
    >;

  deleteById(
    id: string
  ):
    Promise<boolean>;

  setEnabled(
    id: string,
    enabled: boolean
  ):
    Promise<
      WatchlistItem | null
    >;
}
