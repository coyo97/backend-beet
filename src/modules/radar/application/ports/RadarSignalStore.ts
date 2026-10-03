import type {
  RedCardPressureSignal,
} from "../../domain/entities/RedCardPressureSignal";

export interface StoredRadarSignal {
  publishedAt: string;

  signal:
    RedCardPressureSignal;
}

export interface RadarSignalStore {
  save(
    signal:
      RedCardPressureSignal
  ): Promise<void> | void;

  listRecent(
    limit?: number
  ): StoredRadarSignal[];
}
