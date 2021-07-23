import {itterativeMCTS, monteCarloTreeSearch, State, ActionResultGenerator, SimulateDefaultPolicy, ActionResult} from './monte_carlo_tree_search.js';
import pathfinder from 'mineflayer-pathfinder';
const {Move, Movements, goals} = pathfinder;

// Ms Pac Man notes
//
// * They set a threshold for the number of times child nodes need to  be tested before moving to UCT. They set it to 15.

export const testPath = (bot, mcData, executionTimeMillis: number, explorationFactor: number, itterationsMCTS: number) => {
  const movement = new Movements(bot, mcData);

  const p = bot.entity.position
  const dy = p.y - Math.floor(p.y)
  const b = bot.blockAt(p)
  const start = new Move(p.x, p.y + (b && dy > 0.001 && bot.entity.onGround && b.type !== 0 ? 1 : 0), p.z, movement.countScaffoldingItems(), 0);
  const goal = new goals.GoalXZ(20, 20);

  const initialState: State = {data: start, costToCome: start.cost, terminal: false};

  function* actionGenerator(state: State): ActionResultGenerator {
    const move = state.data;
    const neighborGenerator = movement.getRandomNeighborsGenerator(move);

    for (const neighbor of neighborGenerator) {
      // Don't go backwards as it results in non elementory paths with similar rewards to existing paths.
      // https://ieeexplore.ieee.org/document/6731713
      // They limit reverse actions to the first ply only.
      if (neighbor.posHash === move.posHash) {
        continue;
      }
      const result: ActionResult = {
        action: {
          data: neighbor
        },
        resultState: {
          data: neighbor,
          costToCome: move.cost + neighbor.cost,
          terminal: goal.isEnd(neighbor),
        }
      }
      yield (result);
    }
    return;
  };
  // ##################
  // TODO: This should maybe return if the state was terminal.
  // TODO: Consider the normalization strategy used for the reward.
  //    Ms Pac Man use variable depth paths and normalizes by that.
  // ##################
  const simulateDefaultPolicy: SimulateDefaultPolicy = (startState: State, endState: State): number => {
    // Pick 10 random moves sequentially then compute the proximity to the goal along with the travel cost.
    const startMove = startState.data;
    const move = endState.data;
    let endMove = move;
    // for (let i = 0; i < 1; i++) {
    //   const neighborGenerator = movement.getRandomNeighborsGenerator(endMove);
    //   endMove = neighborGenerator.next().value;
    //   cost += endMove.cost;
    //   if (goal.isEnd(endMove)) {
    //     break;
    //   }
    // }
    const costToCome = endMove.costToCome;
    const costReward = 0.5 + 0.5 / (costToCome + 1);

    const startDistance = goal.heuristic(startMove);
    const currentDistance = goal.heuristic(endMove);
    let distanceReward = 0.5;
    if (currentDistance < startDistance) {
      distanceReward = 0.5 + (0.5 * (startDistance - currentDistance) / startDistance);
    } else {
      distanceReward = (0.5 * startDistance) / currentDistance;
    }
    // TODO: think about the result of this calculation on the search. Is this the best way to combine these rewards?
    const reward = costReward * distanceReward;
    const clampedReward = Math.min(Math.max(reward, 0), 1);
    // console.log({clampedReward, reward, costReward, distanceReward, startDistance, currentDistance, costToCome});
    // console.log(endMove, {depth: null});
    return clampedReward;
  }
  // const bestAction = monteCarloTreeSearch(initialState, actionGenerator, simulateDefaultPolicy, executionTimeMillis, explorationFactor);
  // console.log(bestAction);
  const iMCTS = itterativeMCTS(initialState, actionGenerator, simulateDefaultPolicy, executionTimeMillis, explorationFactor);
  const getNext = (itterations: number, generator) => {
    console.log({itterations});
    if (itterations <= 0) return;
    generator(itterations === 1);
    setImmediate(() => getNext(itterations - 1, generator));
  }
  getNext(itterationsMCTS, (showResult: boolean) => iMCTS.next(showResult));

}
