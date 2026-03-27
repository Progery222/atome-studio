export type Platform = 'Cloudflare' | 'PostHog' | 'Postman';

export type ServiceStatus = 'online' | 'offline' | 'idle' | 'error';

export type ServiceType =
  // Cloudflare
  | 'CF Worker'
  | 'CF Pages'
  | 'R2 Bucket'
  | 'KV Namespace'
  | 'D1 Database'
  // PostHog
  | 'Dashboard'
  | 'PH Insight'
  | 'Feature Flag'
  | 'Survey'
  | 'Experiment'
  // Postman
  | 'API Collection'
  | 'Mock Server'
  | 'Environment'
  | 'API Spec';

export interface Service {
  id: string;
  name: string;
  platform: Platform;
  type: ServiceType | string;
  status: ServiceStatus;
  modified: string;
  /** RGB color of the platform [r, g, b] */
  col: [number, number, number];
  /** Orbit index: 0=CF, 1=PostHog, 2=Postman */
  oi: number;
  /** Initial angle on orbit (radians) */
  a: number;
  /** Angular speed (rad/frame), sign = direction */
  spd: number;
  metadata?: Record<string, unknown>;
}

export interface OrbitConfig {
  /** Semi-major axis */
  a: number;
  /** Semi-minor axis */
  b: number;
  /** Tilt angle in radians */
  tilt: number;
  /** RGB string e.g. '249,115,22' */
  rgb: string;
  platform: Platform;
}

export const ORBIT_CONFIGS: OrbitConfig[] = [
  { a: 196, b: 58,  tilt: -0.20, rgb: '249,115,22',   platform: 'Cloudflare' },
  { a: 162, b: 80,  tilt:  0.44, rgb: '167,139,250',  platform: 'PostHog' },
  { a: 226, b: 48,  tilt:  0.16, rgb: '251,191,36',   platform: 'Postman' },
];

export const PLATFORM_COLORS: Record<Platform, { hex: string; rgb: string }> = {
  Cloudflare: { hex: '#f97316', rgb: '249,115,22' },
  PostHog:    { hex: '#a78bfa', rgb: '167,139,250' },
  Postman:    { hex: '#fbbf24', rgb: '251,191,36' },
};

export interface WorkspaceStats {
  totalServices: number;
  onlineServices: number;
  platforms: number;
  uptimePercent: number;
}

export interface SparklinePoint {
  value: number;
  ts: number;
}

export interface ActivityMetrics {
  eventsPerMin: SparklinePoint[];
  apiCalls: SparklinePoint[];
  latencyMs: SparklinePoint[];
}

// WebSocket event payloads
export interface ServiceStatusChangedEvent {
  type: 'service:status_changed';
  serviceId: string;
  status: ServiceStatus;
}

export interface ServiceMetricsUpdatedEvent {
  type: 'service:metrics_updated';
  metrics: ActivityMetrics;
}

export interface AlertCreatedEvent {
  type: 'alert:created';
  serviceId: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

export type WsEvent =
  | ServiceStatusChangedEvent
  | ServiceMetricsUpdatedEvent
  | AlertCreatedEvent;
