import {expect} from 'chai';
import {State, ActionResultGenerator, SimulateDefaultPolicyRewardGenerator, ActionResult} from './monte_carlo_tree_search.js';

// describe('monteCarloTreeSearch', () => {
//   it('works', () => {
//     const initialState: State = {data: [0, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], costToCome: 0, terminal: false, goalReached: false, distanceTraveled: 0};
//     function* actionGenerator(state: State): ActionResultGenerator {
//       for (let i = 0; i < state.data.length; i++) {
//         if (state.data[i] === 1) {
//           continue;
//         }
//         const stateClone = [...state.data];
//         stateClone[i] = 1;
//         const statesExausted = stateClone.every((e) => e === 1);
//         const result: ActionResult = {
//           action: {
//             data: i
//           },
//           resultState: {
//             data: stateClone,
//             costToCome: state.costToCome + 1,
//             terminal: statesExausted,
//             goalReached: statesExausted,
//             distanceTraveled: state.distanceTraveled + 1,
//           }
//         }
//         yield (result);
//       }
//       return;
//     };
//     function* simulateDefaultPolicy(state: State): Generator<number, number, undefined> {
//       return Math.random();
//     }
//     const explorationFactor = 1 / Math.sqrt(2);
//     const mixmaxFactor = 1.0;
//     const bestAction = monteCarloTreeSearch(initialState, actionGenerator, simulateDefaultPolicy, 200, mixmaxFactor, explorationFactor);
//     // console.log(bestAction);
//   });
// });
