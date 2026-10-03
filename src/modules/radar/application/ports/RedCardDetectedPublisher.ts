import type {
  RedCardDetectedSignal,
} from "../../domain/entities/RedCardDetectedSignal";

export interface RedCardDetectedPublisher {
  publish(
    signal:
      RedCardDetectedSignal
  ): Promise<void>;
}
