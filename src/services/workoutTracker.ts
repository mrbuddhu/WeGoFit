export type WorkoutType = 'running' | 'cycling' | 'walking' | 'hiking' | 'swimming';

export interface GpsPoint {
  lat: number;
  lng: number;
  altitude: number;
  speed: number; // m/s from browser
  accuracy: number;
  timestamp: number;
}

export interface WorkoutUpdate {
  currentSpeed: number;  // km/h
  averageSpeed: number;  // km/h
  maxSpeed: number;      // km/h
  totalDistance: number; // metres
  elevationGain: number; // metres
  duration: number;      // seconds
  calories: number;
  positions: GpsPoint[];
}

export interface WorkoutSplit {
  km: number;
  time_sec: number;
  pace: string;
}

export interface WorkoutSummary {
  workoutType: WorkoutType;
  date: string;
  startTime: string;
  duration_sec: number;
  distance_m: number;
  distance_km: number;
  calories: number;
  averageSpeed: number;
  maxSpeed: number;
  elevationGain: number;
  positions: GpsPoint[];
  splits: WorkoutSplit[];
}

type CallbackMap = {
  update?: (data: WorkoutUpdate) => void;
  error?: (msg: string) => void;
};

// Using gpt-4o-mini pattern: ~$0.00015 per lookup — here no cost, pure browser GPS
class WorkoutTracker {
  watchId: number | null = null;
  positions: GpsPoint[] = [];
  startTime: number | null = null;
  isTracking = false;
  totalDistance = 0;  // metres
  currentSpeed = 0;   // km/h
  maxSpeed = 0;       // km/h
  averageSpeed = 0;   // km/h
  elevationGain = 0;  // metres
  workoutType: WorkoutType = 'running';
  private _paused = false;
  private callbacks: CallbackMap = {};

  start(workoutType: WorkoutType) {
    if (!navigator.geolocation) throw new Error('GPS_NOT_SUPPORTED');
    this.startTime = Date.now();
    this.isTracking = true;
    this.positions = [];
    this.totalDistance = 0;
    this.currentSpeed = 0;
    this.maxSpeed = 0;
    this.averageSpeed = 0;
    this.elevationGain = 0;
    this._paused = false;
    this.workoutType = workoutType;

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this._onPosition(pos),
      (err) => this._onError(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
    );
  }

  stop(): WorkoutSummary {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.isTracking = false;
    }
    return this._buildSummary();
  }

  pause() { this._paused = true; }
  resume() { this._paused = false; }

  private _onPosition(position: GeolocationPosition) {
    if (this._paused) return;
    const { latitude, longitude, altitude, speed, accuracy } = position.coords;
    const timestamp = position.timestamp;

    const point: GpsPoint = {
      lat: latitude,
      lng: longitude,
      altitude: altitude ?? 0,
      speed: speed ?? 0,
      accuracy,
      timestamp,
    };

    if (this.positions.length > 0) {
      const last = this.positions[this.positions.length - 1];
      const dist = this._haversine(last.lat, last.lng, latitude, longitude);
      if (accuracy < 30 && dist < 100) {
        this.totalDistance += dist;
      }
      if (altitude != null && last.altitude != null && altitude > last.altitude) {
        this.elevationGain += altitude - last.altitude;
      }
    }

    this.positions.push(point);

    if (speed && speed > 0) {
      this.currentSpeed = speed * 3.6;
    } else if (this.positions.length >= 2) {
      const last = this.positions[this.positions.length - 2];
      const dist = this._haversine(last.lat, last.lng, latitude, longitude);
      const timeDiff = (timestamp - last.timestamp) / 1000;
      this.currentSpeed = timeDiff > 0 ? (dist / timeDiff) * 3.6 : 0;
    }

    if (this.currentSpeed > this.maxSpeed) this.maxSpeed = this.currentSpeed;

    const elapsed = (Date.now() - this.startTime!) / 1000 / 3600;
    this.averageSpeed = elapsed > 0 ? (this.totalDistance / 1000) / elapsed : 0;

    this._emit('update', {
      currentSpeed: Math.round(this.currentSpeed * 10) / 10,
      averageSpeed: Math.round(this.averageSpeed * 10) / 10,
      maxSpeed: Math.round(this.maxSpeed * 10) / 10,
      totalDistance: Math.round(this.totalDistance),
      elevationGain: Math.round(this.elevationGain),
      duration: Math.round((Date.now() - this.startTime!) / 1000),
      positions: this.positions,
      calories: this._estimateCalories(),
    });
  }

  private _haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private _estimateCalories(): number {
    const MET: Record<string, number> = {
      running: 8.5, cycling: 6.0, walking: 3.5, hiking: 5.3, swimming: 6.0,
    };
    const profile = JSON.parse(localStorage.getItem('gofit_user_profile') ?? '{}');
    const weight = profile.currentWeightKg ?? 75;
    const hours = (Date.now() - this.startTime!) / 1000 / 3600;
    return Math.round((MET[this.workoutType] ?? 5.0) * weight * hours);
  }

  private _buildSummary(): WorkoutSummary {
    const duration = Math.round((Date.now() - (this.startTime ?? Date.now())) / 1000);
    return {
      workoutType: this.workoutType,
      date: new Date().toISOString().split('T')[0],
      startTime: new Date(this.startTime ?? Date.now()).toISOString(),
      duration_sec: duration,
      distance_m: Math.round(this.totalDistance),
      distance_km: Math.round(this.totalDistance / 10) / 100,
      calories: this._estimateCalories(),
      averageSpeed: Math.round(this.averageSpeed * 10) / 10,
      maxSpeed: Math.round(this.maxSpeed * 10) / 10,
      elevationGain: Math.round(this.elevationGain),
      positions: this.positions,
      splits: this._calculateSplits(),
    };
  }

  private _calculateSplits(): WorkoutSplit[] {
    const splits: WorkoutSplit[] = [];
    let kmMark = 1000;
    let distSoFar = 0;
    let splitStart = this.startTime ?? 0;

    this.positions.forEach((p, i) => {
      if (i === 0) return;
      const prev = this.positions[i - 1];
      distSoFar += this._haversine(prev.lat, prev.lng, p.lat, p.lng);
      if (distSoFar >= kmMark) {
        const splitTime = (p.timestamp - splitStart) / 1000;
        splits.push({
          km: kmMark / 1000,
          time_sec: Math.round(splitTime),
          pace: `${Math.floor(splitTime / 60)}:${String(Math.round(splitTime % 60)).padStart(2, '0')} /km`,
        });
        splitStart = p.timestamp;
        kmMark += 1000;
      }
    });
    return splits;
  }

  private _onError(error: GeolocationPositionError) {
    const messages: Record<number, string> = {
      1: 'GPS_PERMISSION_DENIED',
      2: 'GPS_POSITION_UNAVAILABLE',
      3: 'GPS_TIMEOUT',
    };
    this._emit('error', messages[error.code] ?? 'GPS_UNKNOWN_ERROR');
  }

  on<K extends keyof CallbackMap>(event: K, callback: CallbackMap[K]) {
    this.callbacks[event] = callback;
  }

  private _emit<K extends keyof CallbackMap>(event: K, data: Parameters<NonNullable<CallbackMap[K]>>[0]) {
    const cb = this.callbacks[event] as ((d: typeof data) => void) | undefined;
    cb?.(data);
  }
}

export const workoutTracker = new WorkoutTracker();
export default workoutTracker;
