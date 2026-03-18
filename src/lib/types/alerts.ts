export type AlertType =
  | "confluence_approach"
  | "zone_approach"
  | "bias_shift"
  | "session_optimal";

export type AlertSeverity = "info" | "warning" | "danger";

export interface SmartAlert {
  id: string;
  type: AlertType;
  instrumentId: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  level?: number;
  createdAt: number;
  dismissed: boolean;
  expiresAt: number;
}

export interface AlertConfig {
  enabled: boolean;
  proximityPercent: number; // e.g. 0.3 = 0.3% proximity to trigger
  maxActiveAlerts: number;
  cooldownMinutes: number;
}

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  enabled: true,
  proximityPercent: 0.3,
  maxActiveAlerts: 10,
  cooldownMinutes: 30,
};
