import {iterativeMCTS, State, ActionResultGenerator, SimulateDefaultPolicyRewardGenerator, ActionResult, TreeNode, MCTSResponse} from './monte_carlo_tree_search.js';
import pathfinder from 'mineflayer-pathfinder';
import {computeScalarizedCompositeReward} from './reward.js';
const {Move, Movements, goals} = pathfinder;
import {performance} from 'perf_hooks';

// Ms Pac Man notes
//
// * They set a threshold for the number of times child nodes need to  be tested before moving to UCT. They set it to 15.

export const testPath = (bot, mcData, executionTimeMillis: number, mixmaxFactor: number, explorationFactor: number, percentBetterNode: number, iterationsMCTS: number, efficiencyWeight: number, distanceWeight: number, biasWeight: number, goalBias: number, goalPos, renderTreeNode: any, renderPosArray: any): Promise<MCTSResponse> => {
  console.log({
    executionTimeMillis,
    mixmaxFactor,
    explorationFactor,
    percentBetterNode,
    iterationsMCTS,
    efficiencyWeight,
    distanceWeight,
    biasWeight,
    goalBias,
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
  movement.liquidCost = 2;

  const p = bot.entity.position
  const dy = p.y - Math.floor(p.y)
  const b = bot.blockAt(p)
  const start = new Move(p.x, p.y + (b && dy > 0.001 && bot.entity.onGround && b.type !== 0 ? 1 : 0), p.z, movement.countScaffoldingItems(), 0);
  // TODO: extract and test
  const manhattenDistanceToGoal = (pos): number => {
    const result = Math.abs(goalPos.x - pos.x) + Math.abs(goalPos.y - pos.y) + Math.abs(goalPos.z - pos.z);
    // console.log({
    //   goalPosX: goalPos.x,
    //   goalPosY: goalPos.y,
    //   goalPosZ: goalPos.z,
    //   posX: pos.x,
    //   posY: pos.y,
    //   posZ: pos.z,
    //   result
    // });
    return result;
  }
  const goal = new goals.GoalBlock(goalPos.x, goalPos.y, goalPos.z);
  renderPosArray([goalPos], 'goal', 0x003f5c);

  const initialState: State = {data: start, costToCome: start.cost, terminal: false, goalReached: false, distanceTraveled: 0};
  let goalReachedSimulatedCount = 0;
  let simulatedCount = 0;
  const rewardStats = {count: 0, max: 0, min: 1};
  const updateRewardStats = (reward: number) => {
    rewardStats.count = rewardStats.count + 1;
    if (reward > rewardStats.max) {
      rewardStats.max = reward;
    }
    if (reward < rewardStats.min) {
      rewardStats.min = reward;
    }
  };

  let invalidMoves = 0;
  let validMoves = 0;
  function* actionGenerator(state: State): ActionResultGenerator {
    const move = state.data;
    const neighborGenerator = movement.getRandomNeighborsGenerator(move);

    for (const neighbor of neighborGenerator) {
      // Don't go backwards as it results in non elementory paths with similar rewards to existing paths.
      // https://ieeexplore.ieee.org/document/6731713
      // They limit reverse actions to the first ply only.
      // TODO: find a faster way to filter out moves that will conflict with the elementory goal.
      if (move.priorPosHashes.has(neighbor.posHash)) {
        invalidMoves = invalidMoves + 1;
        continue;
      }
      validMoves = validMoves + 1;
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
  const maxItterations = 5000;
  let previousSimulationStack = [];
  const getPositionsFromSimulationStack = () => {
    return previousSimulationStack.map((element) => element.move);
  }
  const simulationFailureReasons = new Map<string, number>([
    ['max_timestep', 0],
    ['no_valid_path', 0],
  ]);
  function* simulateDefaultPolicy(startState: State, endState: State): Generator<number, number, undefined> {
    // console.log(`####################### new sim starting at ${endState.data}`);
    simulatedCount = simulatedCount + 1;
    // const fakeResult = Math.random();
    // yield fakeResult;
    // return fakeResult;
    // Pick 10 random moves sequentially then compute the proximity to the goal along with the travel cost.
    const startMove = startState.data;
    const move = endState.data;
    const moveStack = [{
      move: endState.data,
      distanceTraveled: endState.distanceTraveled,
      distanceToGoal: manhattenDistanceToGoal(endState.data),
      nextMoveGenerator: undefined,
    }];
    let popCount = 0;
    let distanceTraveled = endState.distanceTraveled;
    let goalReached = false;
    let iterationCount = 0;
    let ensureDistanceProgress = Math.random() > goalBias;
    while (!goalReached) {
      iterationCount = iterationCount + 1;
      if (iterationCount > maxItterations) {
        previousSimulationStack = moveStack;
        simulationFailureReasons.set('max_timestep',
          simulationFailureReasons.get('max_timestep') + 1
        );
        yield 0;
        return 0;
      }
      let lastMove = moveStack?.[moveStack.length - 1];
      if (lastMove == null) {
        // console.log({event: 'move stack empty', iterationCount});
        simulationFailureReasons.set('no_valid_path',
          simulationFailureReasons.get('no_valid_path') + 1
        );
        yield 0;
        return 0;
      }
      if (goal.isEnd(lastMove.move)) {
        goalReached = true;
        break;
      }
      if (lastMove.nextMoveGenerator == null) {
        lastMove.nextMoveGenerator = movement.getRandomNeighborsGenerator(lastMove.move);
      }
      let validNeighbor;
      // NOTE: this may result in moves being rejected if there is no valid move towards the goal.
      // It may be the case that a future move may have 
      for (; ;) {
        const neighbor = lastMove.nextMoveGenerator.next();
        if (neighbor.value == null && !neighbor.done) {
          console.log({neighbor, lastMove});
        }
        if (neighbor.value == null) break;
        if (lastMove.move.priorPosHashes.has(neighbor.value.posHash)) {
          invalidMoves = invalidMoves + 1;
        } else {
          validMoves = validMoves + 1;
          const goalDistanceBias = lastMove.distanceToGoal <= 15 ? Math.max(0.0, (lastMove.distanceToGoal - 5) / 10) : 1.0;
          if (!ensureDistanceProgress) {
            validNeighbor = neighbor.value;
            ensureDistanceProgress = Math.random() > goalBias * goalDistanceBias;
            break;
          } else if (manhattenDistanceToGoal(neighbor.value) < lastMove.distanceToGoal) {
            validNeighbor = neighbor.value;
            ensureDistanceProgress = Math.random() > goalBias * goalDistanceBias;
            break;
          }
        }
        if (neighbor.done) break;
      }
      if (validNeighbor == null) {
        // console.log('self intersection terminal node in default policy');
        popCount = popCount + 1;
        if (popCount > 10) {
          const randPop = Math.floor(Math.random() * Math.min(20, moveStack.length));
          // console.log({randPop});
          for (let i = 0; i < randPop; i++) {
            moveStack.pop();
          }
        }
        moveStack.pop();
      } else {
        moveStack.push({
          move: validNeighbor,
          distanceTraveled: lastMove.distanceTraveled + lastMove.move.distanceTo(validNeighbor),
          distanceToGoal: manhattenDistanceToGoal(validNeighbor),
          nextMoveGenerator: undefined,
        });
      }
      // lastMove = moveStack?.[moveStack.length - 1];
      // if (lastMove != null) {
      //   const goalDistance = manhattenDistanceToGoal(lastMove.move);
      //   console.log({posX: lastMove.move.x, posY: lastMove.move.y, posZ: lastMove.move.z});
      //   console.log({iterationCount, moveCount: moveStack.length, goalDistance, ensureDistanceProgress, popCount});
      // }
      yield;
    }
    const lastMove = moveStack?.[moveStack.length - 1];
    if (lastMove == null) {
      console.log('move stack empty');
      yield 0;
      return 0;
    }
    // const startDistance = goal.heuristic(startMove);
    // const currentDistance = goal.heuristic(endMove);
    distanceTraveled = lastMove.distanceTraveled;
    const startDistance = manhattenDistanceToGoal(startMove);
    const currentDistance = manhattenDistanceToGoal(lastMove.move);
    const costToCome = lastMove.move.costToCome;
    if (goalReached) {
      // Uncomment to enable scaling of via the growthFactor
      goalReachedSimulatedCount = goalReachedSimulatedCount + 1;
    }
    // const growthFactor = efficiencyWeight;
    // const distanceWeightDiscount = Math.pow(growthFactor, goalReachedSimulatedCount) * distanceWeight;
    // const distanceWeightCompliment = 1 - distanceWeightDiscount;

    // Efficiency metric
    // TODO: think about the result of this calculation on the search. Is this the best way to combine these rewards?
    const reward = computeScalarizedCompositeReward(startDistance, currentDistance, distanceTraveled, costToCome, goalReached, distanceWeight, efficiencyWeight, biasWeight);
    // console.log({reward, startDistance, currentDistance, distanceTraveled, costToCome, goalReached, iterationCount});
    // console.log(lastMove, {depth: null});
    // console.log({
    //   startPos: {x: startMove.x, y: startMove.y, z: startMove.z},
    //   statePos: {x: move.x, y: move.y, z: move.z},
    //   endPos: {x: lastMove?.move.x, y: lastMove?.move.y, z: lastMove?.move.z},
    // });

    updateRewardStats(reward);
    // TODO: fix this. This is dumb, but it works.
    previousSimulationStack = moveStack;
    yield reward;

    return reward;
  }
  const logReport = () => {
    console.log({invalidMoves, validMoves});
    console.log({goalReachedSimulatedCount, simulatedCount, simulationFailureReasons});
    console.log({rewardStats});
  }
  // const bestAction = monteCarloTreeSearch(initialState, actionGenerator, simulateDefaultPolicy, executionTimeMillis, explorationFactor);
  // console.log(bestAction);
  const iMCTS = iterativeMCTS(initialState, actionGenerator, simulateDefaultPolicy, executionTimeMillis, mixmaxFactor, explorationFactor, percentBetterNode);
  // const simulateDefault = simulateDefaultPolicy(initialState, initialState);
  // const getNext = (iterations: number, generator) => {
  //   console.log({iterations});
  //   if (iterations <= 0) {
  //     logReport();
  //     return;
  //   }
  //   const result = generator();
  //   if (result.done) {
  //     return result;
  //   }
  //   setImmediate(() => getNext(iterations - 1, generator));
  // }
  // getNext(iterationsMCTS, () => {
  //   return simulateDefault.next();
  // });

  const rootNode = new Promise<MCTSResponse>((resolve, reject) => {
    const getNext = (iterations: number, generator) => {
      const lastEvaluation = iterations <= 0;
      const result = generator(lastEvaluation);
      if (iterations % 10 === 0 || lastEvaluation) {
        console.log({iterations});
      }
      if (iterations % 20 === 0 || lastEvaluation) {
        renderTreeNode(result.value.rootNode);
        // renderPosArray(getPositionsFromSimulationStack(), 'rollout', 0xffa600);
      }
      if (lastEvaluation) {
        logReport();
        resolve(result.value);
        return;
      }
      setImmediate(() => getNext(iterations - 1, generator));
    }
    getNext(iterationsMCTS, (showResult: boolean) => {
      return iMCTS.next({logDetails: showResult, pruneRootNode: Math.random() > 1.0})
    });
  });

  return rootNode;
}
