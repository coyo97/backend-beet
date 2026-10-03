export type DominantSide =
  | "home"
  | "away"
  | null;

export type PressureLevel =
  | "balanced"
  | "slight"
  | "clear"
  | "strong";

export type AnalysisConfidence =
  | "low"
  | "medium"
  | "high";

export interface PressureComponent {
  metric: string;
  label: string;

  weight: number;

  homeValue: number;
  awayValue: number;

  homeShare: number;
  awayShare: number;
}

export interface PressureAnalysis {
  homeScore: number;
  awayScore: number;

  difference: number;

  dominantSide:
    DominantSide;

  level:
    PressureLevel;

  confidence:
    AnalysisConfidence;

  availableWeight:
    number;

  components:
    PressureComponent[];
}
