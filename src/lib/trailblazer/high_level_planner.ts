import {itterativeMCTS, monteCarloTreeSearch, State, ActionResultGenerator, SimulateDefaultPolicy, ActionResult, TreeNode, MCTSResponse} from './monte_carlo_tree_search.js';
import pathfinder from 'mineflayer-pathfinder';
import {computeScalarizedCompositeReward} from './reward.js';
const {Move, Movements, goals} = pathfinder;

// Ms Pac Man notes
//
// * They set a threshold for the number of times child nodes need to  be tested before moving to UCT. They set it to 15.

export const testPath = (bot, mcData, executionTimeMillis: number, mixmaxFactor: number, explorationFactor: number, percentBetterNode: number, itterationsMCTS: number, efficiencyWeight: number, distanceWeight: number, biasWeight: number, goalPos, render: any): Promise<MCTSResponse> => {
  console.log({
    mixmaxFactor,
    explorationFactor,
    efficiencyWeight,
    distanceWeight,
    biasWeight,
    goalPos,
  });
  if (efficiencyWeight > 1 || efficiencyWeight < 0) {
    throw new Error('efficiencyWeight must be between 0 and 1 inclusive');
  }
  if (distanceWeight > 1 || distanceWeight < 0) {
    throw new Error('distanceWeight must be between 0 and 1 inclusive');
  }
  const movement = new Movements(bot, mcData);
  movement.allowMutationHistory = true;

  const p = bot.entity.position
  const dy = p.y - Math.floor(p.y)
  const b = bot.blockAt(p)
  const start = new Move(p.x, p.y + (b && dy > 0.001 && bot.entity.onGround && b.type !== 0 ? 1 : 0), p.z, movement.countScaffoldingItems(), 0);
  // TODO: extract and test
  const manhattenDistanceToGoal = (pos): number => {
    return Math.abs(goalPos.x - pos.x) + Math.abs(goalPos.y - pos.y) + Math.abs(goalPos.z - pos.z);
  }
  const goal = new goals.GoalBlock(goalPos.x, goalPos.y, goalPos.z);

  const initialState: State = {data: start, costToCome: start.cost, terminal: false, goalReached: false, distanceTraveled: 0};
  let goalSimulatedCount = 0;
  const rewardStats = {count: 0, max: 0, min: 1};
  const updateRewardStats = (reward: number) => {
    rewardStats.count++;
    if (reward > rewardStats.max) {
      rewardStats.max = reward;
    }
    if (reward < rewardStats.min) {
      rewardStats.min = reward;
    }
  };

  let invalidMoves = 0;
  function* actionGenerator(state: State): ActionResultGenerator {
    const move = state.data;
    const neighborGenerator = movement.getRandomNeighborsGenerator(move);

    for (const neighbor of neighborGenerator) {
      // Don't go backwards as it results in non elementory paths with similar rewards to existing paths.
      // https://ieeexplore.ieee.org/document/6731713
      // They limit reverse actions to the first ply only.
      // TODO: find a faster way to filter out moves that will conflict with the elementory goal.
      if (move.priorPosHashes.has(neighbor.posHash)) {
        invalidMoves++;
        continue;
      }
      const distance = move.distanceTo(neighbor);
      const goalReached = goal.isEnd(neighbor);
      const result: ActionResult = {
        action: {
          data: neighbor
        },
        resultState: {
          data: neighbor,
          // TODO: remove this from the state.
          costToCome: neighbor.costToCome,
          terminal: goalReached,
          goalReached,
          distanceTraveled: state.distanceTraveled + distance,
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
  const simulateCount = 500;
  const simulateDefaultPolicy: SimulateDefaultPolicy = (startState: State, endState: State): number => {
    // Pick 10 random moves sequentially then compute the proximity to the goal along with the travel cost.
    const startMove = startState.data;
    const move = endState.data;
    const moveStack = [{
      move: endState.data,
      distance: endState.distanceTraveled,
      nextMoveGenerator: undefined,
    }];
    let distanceTraveled = endState.distanceTraveled;
    let goalReached = false;
    for (let i = 0; i < simulateCount; i++) {
      const lastMove = moveStack?.[moveStack.length - 1];
      if (lastMove == null) {
        console.log({event: 'move stack empty', i});
        break;
      }
      if (goal.isEnd(lastMove.move)) {
        goalReached = true;
        break;
      }
      if (lastMove.nextMoveGenerator == null) {
        lastMove.nextMoveGenerator = movement.getRandomNeighborsGenerator(lastMove.move);
      }
      let validNeighbor;
      for (const neighbor of lastMove.nextMoveGenerator) {
        if (!lastMove.move.priorPosHashes.has(neighbor.posHash)) {
          validNeighbor = neighbor;
          break;
        }
      }
      if (validNeighbor == null) {
        // console.log('self intersection terminal node in default policy');
        moveStack.pop();
        continue;
      }
      moveStack.push({
        move: validNeighbor,
        distance: lastMove.distance + lastMove.move.distanceTo(validNeighbor),
        nextMoveGenerator: undefined,
      });
    }
    const lastMove = moveStack?.[moveStack.length - 1];
    if (lastMove == null) {
      console.log('move stack empty');
      return 0;
    }
    // const startDistance = goal.heuristic(startMove);
    // const currentDistance = goal.heuristic(endMove);
    distanceTraveled = lastMove.distance;
    const startDistance = manhattenDistanceToGoal(startMove);
    const currentDistance = manhattenDistanceToGoal(lastMove.move);
    const costToCome = lastMove.move.costToCome;
    if (goalReached) {
      // Uncomment to enable scaling of via the growthFactor
      // goalSimulatedCount++;
    }
    // const growthFactor = efficiencyWeight;
    // const distanceWeightDiscount = Math.pow(growthFactor, goalSimulatedCount) * distanceWeight;
    // const distanceWeightCompliment = 1 - distanceWeightDiscount;

    // Efficiency metric
    // TODO: think about the result of this calculation on the search. Is this the best way to combine these rewards?
    const reward = computeScalarizedCompositeReward(startDistance, currentDistance, distanceTraveled, costToCome, goalReached, distanceWeight, efficiencyWeight, biasWeight);
    console.log({reward, startDistance, currentDistance, distanceTraveled, costToCome, goalReached});
    // console.log(endMove, {depth: null});
    console.log({
      startPos: {x: startMove.x, y: startMove.y, z: startMove.z},
      statePos: {x: move.x, y: move.y, z: move.z},
      endPos: {x: lastMove?.move.x, y: lastMove?.move.y, z: lastMove?.move.z},
    });

    updateRewardStats(reward);
    return reward;
  }
  const logReport = () => {
    console.log({invalidMoves});
    console.log({goalSimulatedCount});
    console.log({rewardStats});
  }
  // const bestAction = monteCarloTreeSearch(initialState, actionGenerator, simulateDefaultPolicy, executionTimeMillis, explorationFactor);
  // console.log(bestAction);
  const iMCTS = itterativeMCTS(initialState, actionGenerator, simulateDefaultPolicy, executionTimeMillis, mixmaxFactor, explorationFactor, percentBetterNode);
  const rootNode = new Promise<MCTSResponse>((resolve, reject) => {
    const getNext = (itterations: number, generator) => {
      console.log({itterations});
      if (itterations <= 0) {
        logReport();
        return;
      }
      const result = generator(itterations === 1);
      if (itterations % 3 === 0 || itterations === 1) {
        render(result.value.rootNode);
      }
      if (itterations === 1) resolve(result.value);
      setImmediate(() => getNext(itterations - 1, generator));
    }
    getNext(itterationsMCTS, (showResult: boolean) => {
      return iMCTS.next({logDetails: showResult, pruneRootNode: Math.random() > 1.0})
    });
  });

  return rootNode;
}
