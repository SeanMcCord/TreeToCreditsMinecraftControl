export const computeDistanceReward = (startDistance: number, currentDistance: number, distanceWeight: number): number => {
  let distanceReward = 0.5;
  if (currentDistance < startDistance) {
    distanceReward = 0.5 + (0.5 * (startDistance - currentDistance) / startDistance);
  } else {
    distanceReward = (0.5 * startDistance) / currentDistance;
  }
  distanceReward = Math.min(Math.max(distanceReward, 0), 1);
  distanceReward = (1 - distanceWeight) + distanceWeight * distanceReward;
  return distanceReward;
}
