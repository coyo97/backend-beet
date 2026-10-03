import type {
  RedCardPressureSignal,
} from "../../domain/entities/RedCardPressureSignal";

export interface RadarSignalPublisher {
  publish(
    signal:
      RedCardPressureSignal
  ): Promise<void> | void;
}
