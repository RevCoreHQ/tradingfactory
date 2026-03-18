export interface CurrencyExposure {
  currency: string;
  netExposure: number; // positive = net long, negative = net short
  contributingPairs: {
    instrumentId: string;
    direction: "long" | "short";
    biasStrength: number;
  }[];
}

export interface CorrelationWarning {
  type: "correlated_longs" | "correlated_shorts" | "double_exposure" | "hedged";
  severity: "info" | "warning" | "danger";
  message: string;
  instruments: string[];
}

export interface PortfolioRiskAssessment {
  exposures: CurrencyExposure[];
  warnings: CorrelationWarning[];
  diversificationScore: number; // 0-100
  concentrationRisk: "low" | "medium" | "high";
}
