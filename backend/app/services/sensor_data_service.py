from uuid import uuid4

from firebase_admin import firestore

from app.core.firebase import get_db
from app.schemas.iot_collection import SensorDataRequest
from app.services.control_state_service import get_active_session
from app.services.iot_notification_service import create_notification

SESSIONS_COLLECTION = 'sessions'
READINGS_SUBCOLLECTION = 'readings'
ACTIVE_STATUS = 'active'


class SensorValidationError(ValueError):
    pass


class DuplicateReadingError(ValueError):
    pass


def _resolve_dust_voltage(payload: SensorDataRequest) -> float | None:
    if payload.dust_voltage is not None:
        return payload.dust_voltage
    if payload.dust_raw_adc is None:
        return None
    # Fallback for older ESP32 payloads or transient transport issues.
    return float(payload.dust_raw_adc) * 3.3 / 4095.0


def _build_reading_key(payload: SensorDataRequest) -> str:
    return f"{payload.device_id}:{payload.session_id}:{payload.timestamp_ms}"


def _validate_sensor_values(payload: SensorDataRequest) -> None:
    if payload.humidity < 0 or payload.humidity > 100:
        raise SensorValidationError(f"Humidity must be between 0 and 100. Received {payload.humidity}.")
    if payload.temperature < -20 or payload.temperature > 80:
        raise SensorValidationError(f"Temperature is outside the realistic range. Received {payload.temperature}.")
    if payload.dust < 0:
        raise SensorValidationError(f"Dust cannot be negative. Received {payload.dust}.")
    if payload.air_quality < 0:
        raise SensorValidationError(f"Air quality cannot be negative. Received {payload.air_quality}.")


def _notify_sensor_issue(payload: SensorDataRequest, *, title: str, message: str, category: str, severity: str, metadata: dict | None = None) -> None:
    try:
        create_notification(
            title=title,
            message=message,
            category=category,
            severity=severity,
            device_id=payload.device_id,
            session_id=payload.session_id,
            reading_key=_build_reading_key(payload),
            metadata=metadata,
        )
    except RuntimeError:
        pass


def _log_ingestion_event(message: str) -> None:
    print(f"[iot-ingestion] {message}")


def _find_duplicate_reading(session_ref, payload: SensorDataRequest) -> str | None:
    duplicate_docs = (
        session_ref.collection(READINGS_SUBCOLLECTION)
        .where('device_id', '==', payload.device_id)
        .where('timestamp_ms', '==', payload.timestamp_ms)
        .limit(1)
        .stream()
    )
    for doc in duplicate_docs:
        return doc.id
    return None


def write_sensor_reading(payload: SensorDataRequest) -> dict:
    db = get_db()
    if not db:
        raise RuntimeError('Database not connected. Please ensure Firebase is setup.')

    session_ref = db.collection(SESSIONS_COLLECTION).document(payload.session_id)
    session_snapshot = session_ref.get()
    if not session_snapshot.exists:
        raise ValueError('Session not found.')

    session_data = session_snapshot.to_dict() or {}
    if session_data.get('status') != ACTIVE_STATUS:
        raise ValueError('Session is not active.')

    active_session = get_active_session(db=db)
    if not active_session or active_session.get('session_id') != payload.session_id:
        raise ValueError('Session ID does not match the current active session.')

    expected_device_id = session_data.get('device_id')
    if expected_device_id and expected_device_id != payload.device_id:
        raise ValueError('Device ID does not match the active session device.')

    if payload.dust_voltage is None or payload.dust_raw_adc is None:
        _log_ingestion_event(
            f"payload missing optional dust fields: device_id={payload.device_id}, session_id={payload.session_id}, "
            f"timestamp_ms={payload.timestamp_ms}, dust_voltage={payload.dust_voltage}, dust_raw_adc={payload.dust_raw_adc}"
        )

    try:
        _validate_sensor_values(payload)
    except SensorValidationError as exc:
        _notify_sensor_issue(
            payload,
            title='Sensor value validation failed',
            message=str(exc),
            category='validation',
            severity='warning',
            metadata={
                'humidity': payload.humidity,
                'temperature': payload.temperature,
                'dust': payload.dust,
                'air_quality': payload.air_quality,
            },
        )
        raise

    duplicate_reading_id = _find_duplicate_reading(session_ref, payload)
    if duplicate_reading_id:
        duplicate_message = (
            f"Duplicate reading detected for device_id={payload.device_id}, session_id={payload.session_id}, "
            f"timestamp_ms={payload.timestamp_ms}. Existing reading_id={duplicate_reading_id}."
        )
        _log_ingestion_event(duplicate_message)
        _notify_sensor_issue(
            payload,
            title='Duplicate IoT reading replayed',
            message=duplicate_message,
            category='duplicate',
            severity='warning',
            metadata={
                'timestamp_ms': payload.timestamp_ms,
                'existing_reading_id': duplicate_reading_id,
            },
        )
        return {
            'success': True,
            'session_id': payload.session_id,
        }

    reading_id = f"reading_{uuid4().hex[:12]}"
    dust_voltage = _resolve_dust_voltage(payload)

    session_start_time = session_data.get('start_time')
    if session_start_time and hasattr(session_start_time, 'timestamp'):
        session_started_ms = int(session_start_time.timestamp() * 1000)
        if payload.timestamp_ms + 15000 < session_started_ms:
            _log_ingestion_event(
                f"possible delayed/offline replay: device_id={payload.device_id}, session_id={payload.session_id}, "
                f"timestamp_ms={payload.timestamp_ms}, session_started_ms={session_started_ms}"
            )

    reading_document = {
        'reading_id': reading_id,
        'timestamp_ms': payload.timestamp_ms,
        'session_id': payload.session_id,
        'device_id': payload.device_id,
        'recorded_at': firestore.SERVER_TIMESTAMP,
        'dust_voltage': dust_voltage,
        'dust_raw_adc': payload.dust_raw_adc,
        'dust': payload.dust,
        'air_quality': payload.air_quality,
        'temperature': payload.temperature,
        'humidity': payload.humidity,
    }

    if payload.dust_level is not None:
        reading_document['dust_level'] = payload.dust_level
    if payload.sensor_status is not None:
        reading_document['sensor_status'] = payload.sensor_status
    if payload.notes is not None:
        reading_document['notes'] = payload.notes
    if payload.cleanliness_status is not None:
        reading_document['cleanliness_status'] = payload.cleanliness_status
    if payload.anomaly_status is not None:
        reading_document['anomaly_status'] = payload.anomaly_status
    if payload.cleanliness_score is not None:
        reading_document['cleanliness_score'] = payload.cleanliness_score
    if payload.cleaning_urgency is not None:
        reading_document['cleaning_urgency'] = payload.cleaning_urgency
    if payload.cleanliness_prediction is not None:
        reading_document['cleanliness_prediction'] = payload.cleanliness_prediction
    if payload.anomaly_prediction is not None:
        reading_document['anomaly_prediction'] = payload.anomaly_prediction
    if payload.prediction_reason is not None:
        reading_document['prediction_reason'] = payload.prediction_reason
    if payload.anomaly_reason is not None:
        reading_document['anomaly_reason'] = payload.anomaly_reason
    if payload.next_dust_prediction is not None:
        reading_document['next_dust_prediction'] = payload.next_dust_prediction
    if payload.model_source is not None:
        reading_document['model_source'] = payload.model_source
    if payload.model_version is not None:
        reading_document['model_version'] = payload.model_version

    reading_ref = session_ref.collection(READINGS_SUBCOLLECTION).document(reading_id)

    batch = db.batch()
    batch.set(reading_ref, reading_document)
    batch.update(
        session_ref,
        {
            'total_readings': firestore.Increment(1),
            'updated_at': firestore.SERVER_TIMESTAMP,
        },
    )
    batch.commit()

    _log_ingestion_event(
        f"accepted reading: reading_id={reading_id}, device_id={payload.device_id}, session_id={payload.session_id}, "
        f"timestamp_ms={payload.timestamp_ms}, dust_voltage={dust_voltage}, dust_raw_adc={payload.dust_raw_adc}"
    )

    return {
        'success': True,
        'session_id': payload.session_id,
    }
