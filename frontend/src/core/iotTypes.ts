export type SessionType = 'before' | 'during' | 'after';
export type MetricKey = 'dust' | 'air_quality' | 'temperature' | 'humidity';

export type HouseOption = {
  house_id: string;
  rooms: string[];
};

export type IoTNotification = {
  notification_id: string;
  title: string;
  message: string;
  category: string;
  severity: string;
  device_id: string | null;
  session_id: string | null;
  reading_key: string | null;
  metadata: Record<string, unknown>;
  read: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type SessionRecord = {
  session_id: string;
  house_id: string;
  room_id: string;
  session_type: SessionType;
  status: string;
  device_id: string;
  total_readings: number;
  start_time: string | null;
  end_time: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ReadingPoint = {
  reading_id: string;
  session_id: string;
  session_type: SessionType;
  timestamp_ms: number;
  recorded_at: string | null;
  dust_voltage: number | null;
  dust_raw_adc: number | null;
  dust: number | null;
  air_quality: number | null;
  temperature: number | null;
  humidity: number | null;
  cleanliness_score: number | null;
  cleanliness_status: string | null;
  anomaly_status: string | null;
  cleaning_urgency: string | null;
  predicted_next_cleanliness: number | null;
  actual_cleanliness: number | null;
  trend_direction: string | null;
  cleanliness_prediction: string | null;
  anomaly_prediction: string | null;
  next_dust_prediction: number | null;
  prediction_reason: string | null;
  anomaly_reason: string | null;
  model_source: string | null;
  model_version: string | null;
  dust_level: string | null;
  sensor_status: string | null;
};

export type SessionTypeSummary = {
  session_count: number;
  points_count: number;
  avg_dust: number | null;
  avg_air_quality: number | null;
  avg_temperature: number | null;
  avg_humidity: number | null;
  latest: ReadingPoint | null;
};

export type VisualizationMetrics = {
  sessions_count: number;
  points_count: number;
  averages: {
    dust: number | null;
    air_quality: number | null;
    temperature: number | null;
    humidity: number | null;
  };
  latest: ReadingPoint | null;
  session_type_summary: Record<SessionType, SessionTypeSummary>;
};

export type RoomRankingItem = {
  room_id: string;
  sessions_count: number;
  points_count: number;
  avg_dust: number | null;
  avg_air_quality: number | null;
  avg_temperature: number | null;
  avg_humidity: number | null;
  anomaly_points: number;
  attention_score: number;
  condition: 'good' | 'warning' | 'critical';
};

export type HouseContext = {
  room_ranking: RoomRankingItem[];
  selected_room_rank: number | null;
  most_problematic_room: string | null;
  best_room: string | null;
  house_averages: {
    dust: number | null;
    air_quality: number | null;
    temperature: number | null;
    humidity: number | null;
  };
  selected_room_vs_house: {
    dust_delta: number | null;
    air_quality_delta: number | null;
    temperature_delta: number | null;
    humidity_delta: number | null;
  };
};

export type VisualizationPayload = {
  status: 'success';
  house_id: string;
  room_id: string;
  session_filter: SessionType | null;
  date_from?: string | null;
  date_to?: string | null;
  session_date?: string | null;
  sessions: SessionRecord[];
  readings: ReadingPoint[];
  metrics: VisualizationMetrics;
  house_context?: HouseContext;
};

// ---------------------------------------------------------------------------
// AI Explainability types
// ---------------------------------------------------------------------------

export type FeatureImportanceItem = {
  feature: string;
  importance: number;
};

export type PredictionConfidence = {
  label: string | null;
  score: number | null;
  confidence: number | null;
};

export type ErrorMetrics = {
  mae: number | null;
  average_drift: number | null;
  accuracy: number | null;
  pair_count: number;
};

export type ErrorBucket = {
  range: string;
  count: number;
};

export type ForecastBoundPoint = {
  timestamp_ms: number;
  actual: number | null;
  predicted: number | null;
  upper: number | null;
  lower: number | null;
};

export type DecisionRule = {
  condition?: string;
  operator?: string;
  threshold?: number | string;
  met?: boolean;
  result?: string;
  confidence?: string;
};

export type RelationshipPoint = {
  dust: number | null;
  air_quality: number | null;
  cleanliness: number;
  anomaly: string;
};

export type DriftPoint = {
  timestamp_ms: number;
  error: number;
};

export type ExplainabilityPayload = {
  status: 'success';
  house_id: string;
  room_id: string;
  readings_count: number;
  feature_importance: FeatureImportanceItem[];
  prediction_confidence: PredictionConfidence;
  error_metrics: ErrorMetrics;
  error_distribution: ErrorBucket[];
  forecast_bounds: ForecastBoundPoint[];
  decision_rules: DecisionRule[];
  relationship_data: RelationshipPoint[];
  drift_over_time: DriftPoint[];
};

// ---------------------------------------------------------------------------
// Presence Detection types (ESP32-CAM)
// ---------------------------------------------------------------------------

export type Detection = {
  type: string;
  label: string;
  confidence: number;
  bbox?: { x1: number; y1: number; x2: number; y2: number } | null;
};

export type CameraFrame = {
  id: string;
  deviceId: string | null;
  roomId: string | null;
  sessionId: string | null;
  timestamp: number | null;
  receivedAt: number | null;
  imagePath: string | null;
  sizeBytes: number | null;
  detections: Detection[];
  modelVersion: string | null;
  latencyMs: number | null;
  imageWidth: number | null;
  imageHeight: number | null;
};

export type PresenceController = {
  sessionId?: string;
  roomId?: string;
  status?: string;
  startTime?: number;
};

export type ActivityStatus = {
  sessionId?: string;
  active?: boolean;
  score?: number;
  totalFrames?: number;
  personFrames?: number;
  toolFrames?: number;
  cooccurFrames?: number;
  toolLabels?: string[];
  presenceStatus?: string;
  presenceEvent?: string;
  updatedAt?: number;
};

export type PresenceLivePayload = {
  controller: PresenceController | null;
  frame: CameraFrame | null;
  activity: ActivityStatus | null;
};

export type PresenceAlert = {
  key: string;
  event: string;
  status: string;
  deviceId: string | null;
  roomId: string | null;
  timestamp: number | null;
  absenceMs: number | null;
  source: string | null;
};

export type ActivityTimelineEvent = {
  key: string;
  active: boolean;
  score: number;
  timestamp: number;
  createdAt: number;
};

export type PresenceSession = {
  sessionId: string;
  roomId: string | null;
  sessionName: string | null;
  startTime: number | null;
  endTime: number | null;
  beforeDuration: number | null;
  duringDuration: number | null;
  afterDuration: number | null;
};
