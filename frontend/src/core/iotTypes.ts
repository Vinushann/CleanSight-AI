export type SessionType = 'before' | 'during' | 'after';
export type MetricKey = 'dust' | 'air_quality' | 'temperature' | 'humidity';

export type HouseOption = {
  house_id: string;
  rooms: string[];
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
  dust: number | null;
  air_quality: number | null;
  temperature: number | null;
  humidity: number | null;
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
