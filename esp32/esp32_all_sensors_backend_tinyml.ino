#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClient.h>
#include <DHT.h>
#include <time.h>
#include <sys/time.h>
#include <math.h>

#include <TensorFlowLite_ESP32.h>
#include <tensorflow/lite/micro/all_ops_resolver.h>
#include <tensorflow/lite/micro/micro_error_reporter.h>
#include <tensorflow/lite/micro/micro_interpreter.h>
#include <tensorflow/lite/schema/schema_generated.h>
#include <tensorflow/lite/version.h>

#include "cleanliness_classifier_model.h"
#include "anomaly_detector_model.h"
#include "dust_forecaster_model.h"

// ============================================================
//  CleanSightAI - ESP32 + TinyML inference
// ============================================================

// Backend machine LAN IP. Keep this IP reserved in your router/DHCP settings
// so the ESP32 always reaches the same host.
#define BACKEND_BASE_URL "http://192.168.3.4:8000"
#define FIRMWARE_BUILD_TAG "http-fix-2026-05-02-v2"

namespace Config {
  const char* WIFI_SSID = "Vinushan";
  const char* WIFI_PASSWORD = "123456789x";

  const char* BACKEND_URL = BACKEND_BASE_URL;
  const char* DEVICE_ID = "esp32_all_sensors_01";
  const char* MODEL_SOURCE = "esp32_tinyml";
  const char* MODEL_VERSION = "v1";

  const char* NTP_SERVER_1 = "pool.ntp.org";
  const char* NTP_SERVER_2 = "time.google.com";
  constexpr unsigned long TIME_SYNC_TIMEOUT_MS = 15000;

  constexpr int DHT_PIN = 4;
  #define DHT_TYPE DHT22
  constexpr int MQ135_PIN = 35;
  constexpr int DUST_LED_PIN = 26;
  constexpr int DUST_AOUT_PIN = 34;

  constexpr unsigned long WIFI_TIMEOUT_MS = 30000;
  constexpr unsigned long CONTROL_POLL_MS = 1000;
  constexpr unsigned long PUBLISH_INTERVAL_MS = 4000;
  constexpr unsigned long HTTP_TIMEOUT_MS = 5000;

  constexpr int DUST_PULSE_ON_US = 280;
  constexpr int DUST_PULSE_WAIT_US = 40;
  constexpr int DUST_PULSE_OFF_US = 9680;

  constexpr float V_REF = 3.3f;
  constexpr int ADC_MAX = 4095;

  constexpr float BASELINE_VOLTAGE = 0.346f;
  constexpr float SLIGHT_VOLTAGE   = 0.389f;
  constexpr float HEAVY_VOLTAGE    = 0.978f;

  constexpr float DUST_AT_BASELINE = 0.0f;
  constexpr float DUST_AT_SLIGHT   = 32.0f;
  constexpr float DUST_AT_HEAVY    = 200.0f;
  constexpr float DUST_EXTRA_SLOPE = 120.0f;
  constexpr float DUST_MAX_CAP     = 500.0f;

  constexpr int   DUST_SAMPLES_PER_CYCLE = 9;
  constexpr int   DUST_MIN_VALID_SAMPLES = 5;
  constexpr float DUST_MAX_JUMP_V = 1.20f;
  constexpr float DUST_NOISY_SPREAD_V = 0.12f;
  constexpr float DUST_SATURATION_V = 3.00f;
  constexpr int   DUST_SAMPLE_INTER_DELAY_MS = 40;
  constexpr float DUST_EMA_ALPHA = 0.35f;
}

struct TinyMlPrediction {
  const char* cleanliness = "unknown";
  const char* anomaly = "unknown";
  float nextDust = -1.0f;
  bool ok = false;
};

DHT dht(Config::DHT_PIN, DHT_TYPE);

bool collecting = false;
String activeSessionId = "";
String activeDeviceId = "";
unsigned long lastControlPollMs = 0;
unsigned long lastPublishMs = 0;

float lastGoodDustVoltage = Config::BASELINE_VOLTAGE;
float filteredDustVoltage = Config::BASELINE_VOLTAGE;
bool hasGoodDustReading = false;

// TinyML runtime state
tflite::MicroErrorReporter g_microErrorReporter;
tflite::ErrorReporter* g_errorReporter = &g_microErrorReporter;
tflite::AllOpsResolver g_resolver;

constexpr int CLEANLINESS_ARENA_BYTES = 28 * 1024;
constexpr int ANOMALY_ARENA_BYTES = 24 * 1024;
constexpr int FORECAST_ARENA_BYTES = 24 * 1024;
alignas(16) uint8_t g_cleanlinessArena[CLEANLINESS_ARENA_BYTES];
alignas(16) uint8_t g_anomalyArena[ANOMALY_ARENA_BYTES];
alignas(16) uint8_t g_forecastArena[FORECAST_ARENA_BYTES];

const tflite::Model* g_cleanlinessModel = nullptr;
const tflite::Model* g_anomalyModel = nullptr;
const tflite::Model* g_forecastModel = nullptr;
tflite::MicroInterpreter* g_cleanlinessInterpreter = nullptr;
tflite::MicroInterpreter* g_anomalyInterpreter = nullptr;
tflite::MicroInterpreter* g_forecastInterpreter = nullptr;
TfLiteTensor* g_cleanlinessInput = nullptr;
TfLiteTensor* g_cleanlinessOutput = nullptr;
TfLiteTensor* g_anomalyInput = nullptr;
TfLiteTensor* g_anomalyOutput = nullptr;
TfLiteTensor* g_forecastInput = nullptr;
TfLiteTensor* g_forecastOutput = nullptr;
bool g_tinyMlReady = false;

struct DustResult {
  bool ok = false;
  bool noisy = false;
  bool usedFallback = false;
  bool saturationWarning = false;
  int validSamples = 0;
  int rejectedSamples = 0;
  float rawMin = 999.0f;
  float rawMax = -999.0f;
  float spread = 0.0f;
  float voltage = NAN;
  const char* status = "INIT";
};

String normalizeBackendBaseUrl() {
  String url = String(Config::BACKEND_URL);
  url.trim();

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "http://" + url;
  }

  while (url.endsWith("/")) {
    url.remove(url.length() - 1);
  }

  return url;
}

String buildApiUrl(const char* path) {
  return normalizeBackendBaseUrl() + String(path);
}

bool connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  WiFi.mode(WIFI_STA);
  WiFi.begin(Config::WIFI_SSID, Config::WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - startedAt >= Config::WIFI_TIMEOUT_MS) {
      Serial.println();
      Serial.println("WiFi connection timeout");
      return false;
    }
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("WiFi connected. IP: ");
  Serial.println(WiFi.localIP());
  return true;
}

void ensureWiFi() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected. Reconnecting...");
    connectWiFi();
  }
}

bool syncClock() {
  configTime(0, 0, Config::NTP_SERVER_1, Config::NTP_SERVER_2);
  Serial.print("Syncing NTP time");
  unsigned long start = millis();
  time_t now = time(nullptr);
  while (now < 1700000000) {
    if (millis() - start > Config::TIME_SYNC_TIMEOUT_MS) {
      Serial.println();
      Serial.println("NTP sync timeout");
      return false;
    }
    delay(500);
    Serial.print(".");
    now = time(nullptr);
  }
  Serial.println();
  Serial.println("NTP time synced");
  return true;
}

unsigned long long currentEpochMs() {
  struct timeval tv;
  gettimeofday(&tv, nullptr);
  if (tv.tv_sec < 1700000000) return 0;
  return (unsigned long long)tv.tv_sec * 1000ULL + (unsigned long long)(tv.tv_usec / 1000ULL);
}

int currentHourOfDay() {
  time_t now = time(nullptr);
  struct tm info;
  if (now <= 0 || localtime_r(&now, &info) == nullptr) return 0;
  return info.tm_hour;
}

bool extractBooleanField(const String& json, const String& key, bool defaultValue) {
  String needle = "\"" + key + "\":";
  int start = json.indexOf(needle);
  if (start == -1) return defaultValue;
  start += needle.length();
  while (start < (int)json.length() && (json[start] == ' ' || json[start] == '\n' || json[start] == '\r')) start++;
  if (json.substring(start, start + 4) == "true") return true;
  if (json.substring(start, start + 5) == "false") return false;
  return defaultValue;
}

String extractStringField(const String& json, const String& key, const String& defaultValue) {
  String needle = "\"" + key + "\":\"";
  int start = json.indexOf(needle);
  if (start == -1) return defaultValue;
  start += needle.length();
  int end = json.indexOf('"', start);
  if (end == -1) return defaultValue;
  return json.substring(start, end);
}

bool pollControlState() {
  if (WiFi.status() != WL_CONNECTED && !connectWiFi()) return false;
  String controlUrl = buildApiUrl("/api/device/control");
  HTTPClient http;
  WiFiClient client;
  Serial.print("Control URL: ");
  Serial.println(controlUrl);
  if (!http.begin(client, controlUrl)) {
    Serial.println("HTTP GET begin failed");
    return false;
  }
  http.setTimeout(Config::HTTP_TIMEOUT_MS);
  int httpCode = http.GET();
  if (httpCode <= 0) {
    Serial.print("Control GET failed: ");
    Serial.println(http.errorToString(httpCode));
    http.end();
    return false;
  }
  String response = http.getString();
  http.end();
  bool newCollecting = extractBooleanField(response, "collecting", false);
  String newSessionId = extractStringField(response, "session_id", "");
  String newDeviceId = extractStringField(response, "device_id", "");

  if (newCollecting && newDeviceId.length() > 0 && newDeviceId != String(Config::DEVICE_ID)) {
    newCollecting = false;
    newSessionId = "";
  }

  collecting = newCollecting;
  activeSessionId = newSessionId;
  activeDeviceId = newDeviceId;
  return true;
}

bool readDht22(float &temperature, float &humidity) {
  humidity = dht.readHumidity();
  temperature = dht.readTemperature();
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("DHT22 read failed");
    return false;
  }
  return true;
}

int readMq135Raw() {
  return analogRead(Config::MQ135_PIN);
}

float readDustVoltageRaw() {
  digitalWrite(Config::DUST_LED_PIN, LOW);
  delayMicroseconds(Config::DUST_PULSE_ON_US);
  int rawADC = analogRead(Config::DUST_AOUT_PIN);
  delayMicroseconds(Config::DUST_PULSE_WAIT_US);
  digitalWrite(Config::DUST_LED_PIN, HIGH);
  delayMicroseconds(Config::DUST_PULSE_OFF_US);
  if (rawADC <= 0 || rawADC >= Config::ADC_MAX) return NAN;
  float voltage = rawADC * (Config::V_REF / Config::ADC_MAX);
  if (isnan(voltage) || voltage < 0.0f || voltage > Config::V_REF) return NAN;
  return voltage;
}

static void sortFloatArray(float arr[], int n) {
  for (int i = 1; i < n; i++) {
    float key = arr[i];
    int j = i - 1;
    while (j >= 0 && arr[j] > key) {
      arr[j + 1] = arr[j];
      j--;
    }
    arr[j + 1] = key;
  }
}

DustResult getRobustDustVoltage() {
  DustResult result;
  float valid[Config::DUST_SAMPLES_PER_CYCLE];
  for (int i = 0; i < Config::DUST_SAMPLES_PER_CYCLE; i++) {
    float v = readDustVoltageRaw();
    if (isnan(v)) {
      result.rejectedSamples++;
      delay(Config::DUST_SAMPLE_INTER_DELAY_MS);
      continue;
    }
    if (hasGoodDustReading && fabsf(v - lastGoodDustVoltage) > Config::DUST_MAX_JUMP_V) {
      result.rejectedSamples++;
      delay(Config::DUST_SAMPLE_INTER_DELAY_MS);
      continue;
    }
    valid[result.validSamples++] = v;
    if (v < result.rawMin) result.rawMin = v;
    if (v > result.rawMax) result.rawMax = v;
    if (v >= Config::DUST_SATURATION_V) result.saturationWarning = true;
    delay(Config::DUST_SAMPLE_INTER_DELAY_MS);
  }

  if (result.validSamples < Config::DUST_MIN_VALID_SAMPLES) {
    if (hasGoodDustReading) {
      result.ok = true;
      result.usedFallback = true;
      result.voltage = lastGoodDustVoltage;
      result.status = "RECOVERED_FROM_LAST_GOOD";
    } else {
      result.ok = false;
      result.status = "SENSOR_FAULT";
    }
    return result;
  }

  sortFloatArray(valid, result.validSamples);
  float median = (result.validSamples % 2 == 1)
    ? valid[result.validSamples / 2]
    : (valid[(result.validSamples / 2) - 1] + valid[result.validSamples / 2]) / 2.0f;
  float sum = 0.0f;
  for (int i = 0; i < result.validSamples; i++) sum += valid[i];
  float mean = sum / result.validSamples;
  float robustVoltage = (median * 0.6f) + (mean * 0.4f);

  result.spread = result.rawMax - result.rawMin;
  result.noisy = result.spread > Config::DUST_NOISY_SPREAD_V;
  result.ok = true;
  result.voltage = robustVoltage;
  result.status = result.noisy ? "NOISY_BUT_VALID" : "OK";

  lastGoodDustVoltage = robustVoltage;
  hasGoodDustReading = true;
  return result;
}

float voltageToDustDensity(float voltage) {
  if (voltage <= Config::BASELINE_VOLTAGE) return Config::DUST_AT_BASELINE;
  if (voltage <= Config::SLIGHT_VOLTAGE) {
    float ratio = (voltage - Config::BASELINE_VOLTAGE) / (Config::SLIGHT_VOLTAGE - Config::BASELINE_VOLTAGE);
    return ratio * Config::DUST_AT_SLIGHT;
  }
  if (voltage <= Config::HEAVY_VOLTAGE) {
    float ratio = (voltage - Config::SLIGHT_VOLTAGE) / (Config::HEAVY_VOLTAGE - Config::SLIGHT_VOLTAGE);
    return Config::DUST_AT_SLIGHT + ratio * (Config::DUST_AT_HEAVY - Config::DUST_AT_SLIGHT);
  }
  float extra = (voltage - Config::HEAVY_VOLTAGE) * Config::DUST_EXTRA_SLOPE;
  float dust = Config::DUST_AT_HEAVY + extra;
  return min(dust, Config::DUST_MAX_CAP);
}

const char* classifyDustLevel(float dustUgM3) {
  if (dustUgM3 < 25.0f) return "clean";
  if (dustUgM3 < 80.0f) return "slight";
  return "heavy";
}

int8_t quantizeToInt8(float value, const TfLiteTensor* tensor) {
  const float scale = tensor->params.scale;
  const int zeroPoint = tensor->params.zero_point;
  if (scale == 0.0f) return 0;
  int q = (int)lroundf(value / scale) + zeroPoint;
  if (q < -128) q = -128;
  if (q > 127) q = 127;
  return (int8_t)q;
}

float dequantizeFromInt8(int8_t value, const TfLiteTensor* tensor) {
  return (value - tensor->params.zero_point) * tensor->params.scale;
}

bool initTinyMl() {
  g_cleanlinessModel = tflite::GetModel(g_cleansight_cleanliness_classifier_model);
  g_anomalyModel = tflite::GetModel(g_cleansight_anomaly_detector_model);
  g_forecastModel = tflite::GetModel(g_cleansight_dust_forecaster_model);
  if (g_cleanlinessModel->version() != TFLITE_SCHEMA_VERSION ||
      g_anomalyModel->version() != TFLITE_SCHEMA_VERSION ||
      g_forecastModel->version() != TFLITE_SCHEMA_VERSION) {
    Serial.println("TinyML schema mismatch");
    return false;
  }

  static tflite::MicroInterpreter cleanlinessInterpreter(
      g_cleanlinessModel, g_resolver, g_cleanlinessArena, CLEANLINESS_ARENA_BYTES, g_errorReporter);
  static tflite::MicroInterpreter anomalyInterpreter(
      g_anomalyModel, g_resolver, g_anomalyArena, ANOMALY_ARENA_BYTES, g_errorReporter);
  static tflite::MicroInterpreter forecastInterpreter(
      g_forecastModel, g_resolver, g_forecastArena, FORECAST_ARENA_BYTES, g_errorReporter);

  g_cleanlinessInterpreter = &cleanlinessInterpreter;
  g_anomalyInterpreter = &anomalyInterpreter;
  g_forecastInterpreter = &forecastInterpreter;

  if (g_cleanlinessInterpreter->AllocateTensors() != kTfLiteOk ||
      g_anomalyInterpreter->AllocateTensors() != kTfLiteOk ||
      g_forecastInterpreter->AllocateTensors() != kTfLiteOk) {
    Serial.println("TinyML tensor allocation failed");
    return false;
  }

  g_cleanlinessInput = g_cleanlinessInterpreter->input(0);
  g_cleanlinessOutput = g_cleanlinessInterpreter->output(0);
  g_anomalyInput = g_anomalyInterpreter->input(0);
  g_anomalyOutput = g_anomalyInterpreter->output(0);
  g_forecastInput = g_forecastInterpreter->input(0);
  g_forecastOutput = g_forecastInterpreter->output(0);
  return true;
}

TinyMlPrediction runTinyMlInference(float dust, float airQuality, float temperature, float humidity) {
  TinyMlPrediction prediction;
  if (!g_tinyMlReady) return prediction;

  const int hour = currentHourOfDay();

  // Manifest order: dust, air_quality, temperature, humidity, hour_of_day, dust_rolling_mean_3, air_quality_rolling_mean_3
  const float classifierFeatures[7] = {dust, airQuality, temperature, humidity, (float)hour, dust, airQuality};
  for (int i = 0; i < 7; i++) g_cleanlinessInput->data.int8[i] = quantizeToInt8(classifierFeatures[i], g_cleanlinessInput);
  if (g_cleanlinessInterpreter->Invoke() != kTfLiteOk) return prediction;
  int bestIndex = 0;
  int8_t bestValue = g_cleanlinessOutput->data.int8[0];
  for (int i = 1; i < 3; i++) {
    if (g_cleanlinessOutput->data.int8[i] > bestValue) {
      bestValue = g_cleanlinessOutput->data.int8[i];
      bestIndex = i;
    }
  }
  if (bestIndex == 0) prediction.cleanliness = "clean";
  else if (bestIndex == 1) prediction.cleanliness = "needs_attention";
  else prediction.cleanliness = "dirty";

  // Manifest order: dust, air_quality, temperature, humidity
  const float anomalyFeatures[4] = {dust, airQuality, temperature, humidity};
  for (int i = 0; i < 4; i++) g_anomalyInput->data.int8[i] = quantizeToInt8(anomalyFeatures[i], g_anomalyInput);
  if (g_anomalyInterpreter->Invoke() != kTfLiteOk) return prediction;
  float anomalyScore = dequantizeFromInt8(g_anomalyOutput->data.int8[0], g_anomalyOutput);
  prediction.anomaly = anomalyScore >= 0.5f ? "anomaly" : "normal";

  // Manifest order: dust_lag_1, air_quality_lag_1, temperature_lag_1, humidity_lag_1, hour_of_day
  const float forecastFeatures[5] = {dust, airQuality, temperature, humidity, (float)hour};
  for (int i = 0; i < 5; i++) g_forecastInput->data.int8[i] = quantizeToInt8(forecastFeatures[i], g_forecastInput);
  if (g_forecastInterpreter->Invoke() != kTfLiteOk) return prediction;
  prediction.nextDust = dequantizeFromInt8(g_forecastOutput->data.int8[0], g_forecastOutput);

  prediction.ok = true;
  return prediction;
}

bool postCombinedSensorData(const String& payload) {
  if (WiFi.status() != WL_CONNECTED && !connectWiFi()) return false;
  String sensorPostUrl = buildApiUrl("/api/sensor-data");
  HTTPClient http;
  WiFiClient client;
  Serial.print("POST URL: ");
  Serial.println(sensorPostUrl);
  if (!http.begin(client, sensorPostUrl)) {
    Serial.println("HTTP POST begin failed");
    return false;
  }
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(Config::HTTP_TIMEOUT_MS);
  int httpCode = http.POST(payload);
  String response = http.getString();
  http.end();
  if (httpCode == 200 || httpCode == 201) return true;
  Serial.print("POST failed. Code: ");
  Serial.println(httpCode);
  if (response.length() > 0) Serial.println(response);
  return false;
}

String buildCombinedPayload(
    const String& sessionId,
    unsigned long long timestampMs,
    float temperature,
    float humidity,
    float airQuality,
    float dustDensity,
    const char* dustLevel,
    const char* sensorStatus,
    const TinyMlPrediction& prediction
) {
  char tsBuf[24];
  snprintf(tsBuf, sizeof(tsBuf), "%llu", timestampMs);

  String payload;
  payload.reserve(500);
  payload += "{";
  payload += "\"device_id\":\"" + String(Config::DEVICE_ID) + "\",";
  payload += "\"session_id\":\"" + sessionId + "\",";
  payload += "\"timestamp_ms\":" + String(tsBuf) + ",";
  payload += "\"dust\":" + String(dustDensity, 2) + ",";
  payload += "\"air_quality\":" + String(airQuality, 2) + ",";
  payload += "\"temperature\":" + String(temperature, 2) + ",";
  payload += "\"humidity\":" + String(humidity, 2) + ",";
  payload += "\"dust_level\":\"" + String(dustLevel) + "\",";
  payload += "\"sensor_status\":\"" + String(sensorStatus) + "\",";
  payload += "\"cleanliness_prediction\":\"" + String(prediction.cleanliness) + "\",";
  payload += "\"anomaly_prediction\":\"" + String(prediction.anomaly) + "\",";
  payload += "\"next_dust_prediction\":" + String(prediction.nextDust, 2) + ",";
  payload += "\"model_source\":\"" + String(Config::MODEL_SOURCE) + "\",";
  payload += "\"model_version\":\"" + String(Config::MODEL_VERSION) + "\"";
  payload += "}";
  return payload;
}

void setup() {
  Serial.begin(115200);
  Serial.println();
  Serial.print("CleanSight ESP32 build: ");
  Serial.println(FIRMWARE_BUILD_TAG);
  delay(1000);
  pinMode(Config::DUST_LED_PIN, OUTPUT);
  digitalWrite(Config::DUST_LED_PIN, HIGH);
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  dht.begin();
  connectWiFi();
  syncClock();

  g_tinyMlReady = initTinyMl();
  Serial.println(g_tinyMlReady ? "TinyML initialized" : "TinyML init failed; fallback predictions enabled");
}

void loop() {
  ensureWiFi();
  unsigned long now = millis();
  if (now - lastControlPollMs >= Config::CONTROL_POLL_MS) {
    lastControlPollMs = now;
    pollControlState();
  }
  if (!collecting || activeSessionId.length() == 0) {
    delay(100);
    return;
  }
  if (now - lastPublishMs < Config::PUBLISH_INTERVAL_MS) {
    delay(50);
    return;
  }
  lastPublishMs = now;

  unsigned long long timestampMs = currentEpochMs();
  if (timestampMs == 0) {
    syncClock();
    return;
  }

  float temperature = NAN;
  float humidity = NAN;
  if (!readDht22(temperature, humidity)) return;

  int mq135Raw = readMq135Raw();
  float airQuality = (float)mq135Raw;

  DustResult dustResult = getRobustDustVoltage();
  float usedDustVoltage = dustResult.ok
                        ? dustResult.voltage
                        : (hasGoodDustReading ? lastGoodDustVoltage : Config::BASELINE_VOLTAGE);
  filteredDustVoltage = (Config::DUST_EMA_ALPHA * usedDustVoltage)
                      + ((1.0f - Config::DUST_EMA_ALPHA) * filteredDustVoltage);
  float dustDensity = voltageToDustDensity(filteredDustVoltage);
  const char* dustLevel = classifyDustLevel(dustDensity);

  TinyMlPrediction prediction = runTinyMlInference(dustDensity, airQuality, temperature, humidity);
  if (!prediction.ok) {
    prediction.cleanliness = "unknown";
    prediction.anomaly = "unknown";
    prediction.nextDust = -1.0f;
  }

  String payload = buildCombinedPayload(
    activeSessionId,
    timestampMs,
    temperature,
    humidity,
    airQuality,
    dustDensity,
    dustLevel,
    dustResult.status,
    prediction
  );

  Serial.println(payload);
  postCombinedSensorData(payload);
}
