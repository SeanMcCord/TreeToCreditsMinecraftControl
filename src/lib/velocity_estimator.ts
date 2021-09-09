import KalmanFilter from './kalman_filter.js';
import {performance} from 'perf_hooks';
import vec3 from 'vec3';

// I don't think the errors we get are linear or gaussian, but this is just a quick and dirt fix.
// A partical filter may yield better results.
export class VelocityEstimator {
  private kalmanFilterX;
  private kalmanFilterY;
  private kalmanFilterZ;
  private priorMeasurement = null;
  constructor() {
    // NOTE: These values are just the first ones I tried and they worked well. 
    this.kalmanFilterX = new KalmanFilter(0.01, 1.0);
    this.kalmanFilterY = new KalmanFilter(0.01, 1.0);
    this.kalmanFilterZ = new KalmanFilter(0.01, 1.0);
  }

  addPosition(pos) {
    const measurementTime = performance.now();
    if (this.priorMeasurement != null) {
      const deltaX = this.priorMeasurement.pos.x - pos.x;
      const deltaY = this.priorMeasurement.pos.y - pos.y;
      const deltaZ = this.priorMeasurement.pos.z - pos.z;
      // Time is in milliseconds. Divide by 1000
      const deltaT = (this.priorMeasurement.measurementTime - measurementTime);
      this.kalmanFilterX.filter(deltaX / deltaT);
      this.kalmanFilterY.filter(deltaY / deltaT);
      this.kalmanFilterZ.filter(deltaZ / deltaT);
    }
    this.priorMeasurement = {pos, measurementTime};
  }

  // Velocity in m/s
  getVelocity() {
    return vec3(
      this.kalmanFilterX.lastMeasurement(),
      this.kalmanFilterY.lastMeasurement(),
      this.kalmanFilterZ.lastMeasurement(),
    );
  }
}
