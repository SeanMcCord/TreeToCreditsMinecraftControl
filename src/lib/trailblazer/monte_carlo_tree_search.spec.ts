import {expect} from 'chai';
import {monteCarloTreeSearch, State, ActionResultGenerator, SimulateDefaultPolicy, ActionResult} from './monte_carlo_tree_search.js';

describe('monteCarloTreeSearch', () => {
  it('works', () => {
    const initialState: State = {data: [0, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], costToCome: 0, terminal: false};
    function* actionGenerator(state: State): ActionResultGenerator {
      for (let i = 0; i < state.data.length; i++) {
        if (state.data[i] === 1) {
          continue;
        }
        const stateClone = [...state.data];
        stateClone[i] = 1;
        const result: ActionResult = {
          action: {
            data: i
          },
          resultState: {
            data: stateClone,
            costToCome: state.costToCome + 1,
            terminal: stateClone.every((e) => e === 1),
          }
        }
        yield (result);
      }
      return;
    };
    const simulateDefaultPolicy: SimulateDefaultPolicy = (state: State): number => {
      return Math.random();
    }
    const explorationFactor = 1 / Math.sqrt(2);
    const bestAction = monteCarloTreeSearch(initialState, actionGenerator, simulateDefaultPolicy, 200, explorationFactor);
    console.log(bestAction);
  });
});
