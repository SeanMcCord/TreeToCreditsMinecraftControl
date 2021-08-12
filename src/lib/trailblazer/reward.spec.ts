import {expect} from 'chai';
import e from 'cors';
import {computeScalarizedCompositeReward, computeCompositeReward, computeDistanceReward, computeEfficiencyReward} from './reward.js';

describe('computeDistanceReward', () => {
  it('works', () => {
    const weight = 1.0;
    const testValues = [
      [10, 10, 0.5],
      [10, 12, 0.4166],
      [10, 8, 0.6],
      [10, 5, 0.75],
      [10, 0, 1],
    ];
    testValues.forEach(([startDistance, currentDistance, expectedResult]) => {
      const result = computeDistanceReward(startDistance, currentDistance, weight);
      expect(result).eq(expectedResult);
      // console.log({startDistance, currentDistance, expectedResult, result});
    });
  });
});

describe('computeEfficiencyReward', () => {
  it('works', () => {
    const weight = 1.0;
    const testValues = [
      // ok values
      [0, 0, 0.5],
      [2, 2, 0.4166],
      [2, 4, 0.6],
      [5, 6, 0.75],
      [10, 8, 1],
      // bad values
      [0, 3, 0.5],
      [2, 6, 0.4166],
      [2, 8, 0.6],
      [5, 9, 0.75],
      [10, 12, 1],
    ];
    testValues.forEach(([distanceTraveled, costToCome, expectedResult]) => {
      const result = computeEfficiencyReward(distanceTraveled, costToCome, weight);
      // expect(result).eq(expectedResult);
      // console.log({startDistance, currentDistance, costToCome, expectedResult, result});
    });
  });
});

describe('computeCompositeReward', () => {
  it('works', () => {
    const distanceWeight = 1.0;
    const efficiencyWeight = 1.0;
    const testValues = [
      [10, 10, 0, 0],
      [10, 0, 10, 20],
      [10, 0, 10, 10],
      [10, 12, 2, 2],
      [10, 4, 6, 3],
    ]
    testValues.forEach(([startDistance, currentDistance, distanceTraveled, costToCome]) => {
      const reward = computeCompositeReward(startDistance, currentDistance, distanceTraveled, costToCome, distanceWeight, efficiencyWeight);
      //  console.log({startDistance, currentDistance, costToCome, reward});
    })
  });
});

describe('computeScalarizedCompositeReward', () => {
  it('works', () => {
    const distanceWeight = 0.8;
    const efficiencyWeight = 0.2;
    const biasWeight = 0.3;
    const testValues: Array<[number, number, number, number, boolean]> = [
      [10, 0, 10, 10, true],
      [10, 0, 10, 20, true],
      [10, 4, 6, 3, false],
      [10, 4, 6, 9, false],
      [10, 10, 0, 0, false],
      [10, 12, 2, 2, false],
      [10, 12, 2, 8, false],
    ]
    testValues.forEach(([startDistance, currentDistance, distanceTraveled, costToCome, goalReached]) => {
      const reward = computeScalarizedCompositeReward(startDistance, currentDistance, distanceTraveled, costToCome, goalReached, distanceWeight, efficiencyWeight, biasWeight);
      console.log({startDistance, currentDistance, costToCome, goalReached, reward});
    })
  });
});
