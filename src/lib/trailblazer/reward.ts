import {goalReached} from "../rrt_star";

const neutralPoint = 0.2;

export const computeEfficiencyReward = (distanceTraveled: number, costToCome: number, efficiencyWeight: number): number => {
  if (costToCome == 0) {
    return 1;
  }
  let costReward = 1 / (costToCome / (distanceTraveled + 1));
  costReward = neutralPoint + (1 - neutralPoint) * costReward;
  costReward = Math.min(Math.max(costReward, 0), 1);
  // costReward = (1 - efficiencyWeight) + efficiencyWeight * costReward;
  return costReward;
}

const computeSimpleDistanceReward = (currentDistance: number) => {
  let distanceReward = neutralPoint + (1 - neutralPoint) / (currentDistance + 1);
  distanceReward = Math.min(Math.max(distanceReward, 0), 1);
  return distanceReward;
}

export const computeDistanceReward = (startDistance: number, currentDistance: number, distanceWeight: number): number => {
  let distanceReward = neutralPoint;
  if (currentDistance < startDistance) {
    distanceReward = neutralPoint + ((1 - neutralPoint) * (startDistance - currentDistance) / startDistance);
  } else {
    distanceReward = (neutralPoint * startDistance) / currentDistance;
  }
  distanceReward = Math.min(Math.max(distanceReward, 0), 1);
  // distanceReward = (1 - distanceWeight) + distanceWeight * distanceReward;
  return distanceReward;
}

export const computeGoalReward = (goalReached: boolean, costToCome: number): number => {
  if (!goalReached) {
    return 0;
  }
  let goalReward = 1 / (costToCome + 1);
  goalReward = neutralPoint + (1 - neutralPoint) * goalReward;
  goalReward = Math.min(Math.max(goalReward, 0), 1);
  return goalReward;
}

const computeHeuristicReward = (currentDistance: number, costToCome: number): number => {
  const expectedCost = costToCome + currentDistance;
  let heuristicReward = 1 / (expectedCost + 1);
  heuristicReward = neutralPoint + (1 - neutralPoint) * heuristicReward;
  heuristicReward = Math.min(Math.max(heuristicReward, 0), 1);
  return heuristicReward;
}

export const computeCompositeReward = (startDistance: number, currentDistance: number, distanceTraveled: number, costToCome: number, distanceWeight: number, efficiencyWeight: number): number => {
  const efficiencyReward = computeEfficiencyReward(distanceTraveled, costToCome, efficiencyWeight);
  const distanceReward = computeDistanceReward(startDistance, currentDistance, distanceWeight);
  const reward = efficiencyReward * distanceReward;
  return Math.min(Math.max(reward, 0), 1);
}

export const computeScalarizedCompositeReward = (startDistance: number, currentDistance: number, distanceTraveled: number, costToCome: number, goalReached: boolean, distanceWeight: number, efficiencyWeight: number, biasWeight: number): number => {
  const efficiencyReward = computeEfficiencyReward(distanceTraveled, costToCome, 1.0);
  const distanceReward = computeDistanceReward(startDistance, currentDistance, 1.0);
  // const distanceReward = computeSimpleDistanceReward(currentDistance);
  // const heuristicReward = computeHeuristicReward(currentDistance, costToCome);
  // const bias = heuristicReward * efficiencyWeight;
  const bias = efficiencyReward * efficiencyWeight + distanceReward * distanceWeight;

  if (biasWeight === -1) {
    return Math.min(Math.max(bias, 0), 1);
  }
  // To ensure all completed paths have a higher score than promising incomplete paths
  // the bias is set to the max of 1.
  const biasCapped = goalReached ? 1 : bias;
  const goalReward = computeGoalReward(goalReached, costToCome);
  const reward = biasWeight * biasCapped + (1 - biasWeight) * goalReward;
  return Math.min(Math.max(reward, 0), 1);
}
