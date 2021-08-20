import {performance} from 'perf_hooks';
import {v4 as uuidv4} from 'uuid';


export type State = {
  data: any;
  // TODO: costToCome is not relevent to the monte carlo tree search. This should be moved down.
  costToCome: number;
  terminal: boolean;
  // TODO: not sure if I want to keep this, but the concept should be removed from terminal.
  goalReached: boolean;
  distanceTraveled: number;
}

type TreeNodeData = {
  id: string;
  state: State;
  visits: number;
  scoreCumulative: number;
  scoreMax: number;
}

export type TreeNode = {
  data: TreeNodeData;
  inEdge: TreeEdge | undefined;
  outEdges: Array<TreeEdge>;
}

export type Action = {
  data: any;
}

type TreeEdge = {
  id: string;
  source: TreeNode;
  target: TreeNode;
  action: Action;
}

export type ActionResult = {
  action: Action;
  resultState: State;
}

export type ActionResultGenerator = Generator<ActionResult, undefined, undefined>;
export type ActionGenerator = (state: State) => ActionResultGenerator;
export type SimulateDefaultPolicyRewardGenerator = Generator<number, number, undefined>;
export type SimulateDefaultPolicyGenerator = (startState: State, endState: State) => SimulateDefaultPolicyRewardGenerator;

export type ControlInput = {
  logDetails: boolean;
  pruneRootNode: boolean;
}
export type MCTSResponse = {
  rootNode: TreeNode;
  bestPath: Generator<TreeNodeData, void, undefined>;
}
export type ItterativeMCTSGenerator = Generator<MCTSResponse, undefined, ControlInput>;

// TODO: Spell this correctly
export function* itterativeMCTS(
  initialState: State,
  actionGenerator: ActionGenerator,
  simulateDefaultPolicyGenerator: SimulateDefaultPolicyGenerator,
  timeLimitMillis: number,
  mixmaxFactor: number,
  explorationFactor: number,
  percentBetterNode: number): ItterativeMCTSGenerator {
  if (explorationFactor <= 0) {
    throw new Error('explorationFactor must be greater than zero');
  }
  const originalRootNode: TreeNode = {
    data: {
      id: 'root_node',
      state: initialState,
      visits: 0,
      scoreCumulative: 0,
      scoreMax: 0,
    },
    inEdge: undefined,
    outEdges: []
  };
  let rootNode = originalRootNode;
  const actionGeneratorExpandedMap = new Map<string, ActionResultGenerator>();
  const actionGeneratorCompletedSet = new Set<string>();
  const depthMap = new Map<number, number>();
  let controlInput: ControlInput = {logDetails: false, pruneRootNode: false};
  let newNodeCount = 0;
  let previousNodeCount = 0;
  let betterScoreNodeFound = 0;
  let betterPathFound = [];
  let worseScoreNodeFound = 0;
  let totalCalculationTime = 0;
  let defaultPolicyCalculationTime = 0;
  const transpositionMap = new Map<string, TreeNode>();
  const transpositionCountMap = new Map<string, number>();
  transpositionMap.set(rootNode.data.state.data.posHash, rootNode);
  transpositionCountMap.set(rootNode.data.state.data.posHash, 1);
  const duplicateNodeFound = (n: TreeNode): boolean => {
    const hash = n.data.state.data.posHash;
    if (transpositionMap.has(hash)) {
      const previousNode = transpositionMap.get(hash);
      if (n.data.state.terminal) {
        backpropogateReward(n, 0);
        return true;
      }
      if (previousNode.data.id === n.data.id) {
        console.dir(previousNode, {depth: 6});
        console.dir(n, {depth: 6});
        return true;
      }
      const newCount = transpositionCountMap.get(hash) + 1;
      transpositionCountMap.set(hash, newCount);
      if (newCount <= 3) {
        return false;
      }
      if (n.data.state.goalReached) {
        return false;
      }
      worseScoreNodeFound += 1;
      if (n.outEdges.length === 0) {
        const edgeId = n.inEdge.id;
        const index = n.inEdge.source.outEdges.findIndex((e: TreeEdge) => e.id === edgeId);
        if (index !== -1) {
          n.inEdge.source.outEdges.splice(index, 1);
          return true;
        }
      }
      return false;
    } else {
      newNodeCount += 1;
      transpositionMap.set(hash, n);
      transpositionCountMap.set(hash, 1);
      return false;
    }
  }
  const clampReward = (n: TreeNode, reward: number): number => {
    const hash = n.data.state.data.posHash;
    const previousNode = transpositionMap.get(hash);
    const isRootNode = n.inEdge == null;
    if (!isRootNode && previousNode != null) {
      const percentReduction = n.data.scoreMax / previousNode.data.scoreMax;
      // TODO: consider how equal value nodes should be handled
      if (percentReduction < percentBetterNode) {
        // TODO: don't expose this deep knowlege here
        worseScoreNodeFound += 1;
        if (n.outEdges.length === 0) {
          const edgeId = n.inEdge.id;
          const index = n.inEdge.source.outEdges.findIndex((e: TreeEdge) => e.id === edgeId);
          if (index !== -1) {
            // const edgeIdsBefore = n.inEdge.source.outEdges.map((e: TreeEdge) => e.id);
            n.inEdge.source.outEdges.splice(index, 1);
            // const edgeIdsAfter = n.inEdge.source.outEdges.map((e: TreeEdge) => e.id);
            // console.log({edgeId, edgeIdsBefore, edgeIdsAfter});
            // n.data.state.terminal = true;
            // return 0;
          }
        }
      }
    }
    return reward;
  }
  const pruneWorseScoreNode = (n: TreeNode) => {
    const hash = n.data.state.data.posHash;
    const previousNode = transpositionMap.get(hash);
    if (previousNode != null) {
      previousNodeCount += 1;
      const percentReduction = n.data.scoreMax / previousNode.data.scoreMax;
      if (percentReduction > 1.0) {
        betterScoreNodeFound += 1;
        betterPathFound.push({
          previousCost: previousNode.data.scoreMax,
          newCost: n.data.scoreMax,
          percentReduction,
        });
        transpositionMap.set(hash, n);
        if (previousNode.outEdges.length === 0) {
          const edgeId = previousNode.inEdge.id;
          const index = previousNode.inEdge.source.outEdges.findIndex((e: TreeEdge) => e.id === edgeId);
          previousNode.inEdge.source.outEdges.splice(index, 1);
        }
        // TODO: what if this node has children that have good scores?
        // Right now it is being marked termainl and therfore may result in incorrect results.
        // previousNode.data.state.terminal = true;
        // backpropogateReward(previousNode, 0);
      }
    } else {
      newNodeCount += 1;
      transpositionMap.set(hash, n);
    }
  }
  // const worldFrequency = new Map<string, number>();
  // const countWorld = (n: TreeNode) => {
  //   const hash = n.data.state.data.worldHash;
  //   if (worldFrequency.has(hash)) {
  //     worldFrequency.set(hash, worldFrequency.get(hash) + 1);
  //   } else {
  //     worldFrequency.set(hash, 1);
  //   }
  // }
  let goalReachedMinCost: number;
  let goalReachedMinCostOverTime = [];
  const recordGoalReachedMinCostNodes = (node: TreeNode, deltaTime: number) => {
    if (!node.data.state.goalReached) {
      return;
    }
    const cost = node.data.state.costToCome;
    if (goalReachedMinCost != null && cost >= goalReachedMinCost) {
      return;
    }
    goalReachedMinCost = cost;
    goalReachedMinCostOverTime.push({
      deltaTime,
      cost,
      // state: node.data.state,
    });
  }
  const rewardsDuringTimestep = new Map<number, Array<number>>();
  const recordRewardDuringTimestep = (reward: number, timestep: number) => {
    if (rewardsDuringTimestep.has(timestep)) {
      rewardsDuringTimestep.get(timestep).push(reward);
    } else {
      rewardsDuringTimestep.set(timestep, [reward]);
    }
  }
  const logDetails = () => {
    // let nextNode = rootNode;
    // for (; ;) {
    //   console.dir(nextNode.data, {depth: null});
    //   nextNode = bestChild(nextNode, 1.0, 0);
    //   if (nextNode == null) {
    //     break;
    //   }
    // }
    // console.dir(worldFrequency, {depth: null});
    const averageRewardByTimestep = new Map();
    for (const [timestep, rewards] of rewardsDuringTimestep.entries()) {
      const averageReward = rewards.reduce((a, b) => a + b) / rewards.length;
      averageRewardByTimestep.set(timestep, averageReward);
    }
    console.dir(averageRewardByTimestep, {depthMap: null});
    console.dir(depthMap, {depth: null});
    console.dir(goalReachedMinCostOverTime, {depth: null});
    // console.dir(betterPathFound, {depth: null});
    console.log({previousNodeCount, newNodeCount, betterScoreNodeFound, worseScoreNodeFound, totalNodes: previousNodeCount + newNodeCount});
  }

  const pruneRootNode = () => {
    // TODO: don't delete the newRootNode down...
    const deleteData = (node: TreeNode | undefined) => {
      if (node == null) return;
      const posHash = node.data.state.data.posHash;
      const potentialNode = transpositionMap.get(posHash);
      if (potentialNode?.data.id === node.data.id) {
        transpositionMap.delete(posHash);
      }
      node.outEdges.forEach((e) => deleteData(e.target));
    }
    const oldRootNode = rootNode;
    const newRootNode = bestChild(oldRootNode, 1.0, 0);
    console.log({oldRootNodeId: oldRootNode.data.id, newRootNodeId: newRootNode?.data.id});
    if (newRootNode == null) {
      console.log("Can't prune root node without children.");
      console.dir(oldRootNode, {depth: null});
    } else {
      oldRootNode.outEdges = oldRootNode.outEdges.filter((e) => e.target.data.id !== newRootNode.data.id);
      newRootNode.inEdge.target = undefined;
      newRootNode.inEdge = undefined;
      rootNode = newRootNode;
      deleteData(oldRootNode);
      console.log({transpositionMapSize: transpositionMap.size});
    }
  }

  let startTime = performance.now();
  const recordCalculationTime = () => {
    totalCalculationTime = totalCalculationTime + performance.now() - startTime;
  }
  const resetComputationBudget = () => {
    startTime = performance.now();
  };
  const computationBudgetExcceded = (): boolean => {
    return performance.now() - startTime >= timeLimitMillis;
  }

  let timestep = 0;
  for (; ;) {
    // let startTime = performance.now();
    // while (performance.now() - startTime < timeLimitMillis) {
    resetComputationBudget();
    while (!computationBudgetExcceded()) {
      const [node, depth] = treePolicy(rootNode, actionGenerator, actionGeneratorExpandedMap, actionGeneratorCompletedSet, transpositionMap, mixmaxFactor, explorationFactor);
      // countWorld(node);
      if (duplicateNodeFound(node)) {
        continue;
      }
      const simulateDefaultPolicy = simulateDefaultPolicyGenerator(originalRootNode.data.state, node.data.state);
      let reward = 0;
      // totalCalculationTime = totalCalculationTime + performance.now() - startTime;
      // let innerStartTime = performance.now();
      for (const tempReward of simulateDefaultPolicy) {
        // console.log({tempReward});
        if (tempReward != null) {
          reward = tempReward;
        }
        if (computationBudgetExcceded()) {
          const response: MCTSResponse = {
            rootNode,
            bestPath: bestPath(rootNode),
          };
          // totalCalculationTime = totalCalculationTime + performance.now() - innerStartTime;
          recordCalculationTime();
          controlInput = yield response;
          resetComputationBudget();
          timestep++;
          if (controlInput.logDetails) {
            logDetails();
          }
          if (controlInput.pruneRootNode) {
            pruneRootNode();
          }
          // innerStartTime = performance.now();
          // startTime = performance.now();
        }
      }
      // totalCalculationTime = totalCalculationTime + performance.now() - innerStartTime;
      // let afterTime = performance.now();
      // const clampedReward = clampReward(node, reward);
      const clampedReward = reward;
      backpropogateReward(node, clampedReward);
      // recordGoalReachedMinCostNodes(node, totalCalculationTime + performance.now() - afterTime);
      recordRewardDuringTimestep(clampedReward, timestep);
      // pruneWorseScoreNode(node);
      // console.dir(graph.json(), {depth: null});
      depthMap.set(depth, depthMap.has(depth) ? depthMap.get(depth) + 1 : 1);
      // totalCalculationTime = totalCalculationTime + performance.now() - afterTime;
    }
    // const worldFrequency = new Map<string, number>();
    // const positionFrequency = new Map<string, number>();
    // graph.nodes().forEach((element) => {
    //   const state = element.data('state');
    //   // const pos = `x:${state.data.x},y:${state.data.y},z:${state.data.z}`;
    //   const pos = state.data.posHash;
    //   if (positionFrequency.has(pos)) {
    //     positionFrequency.set(pos, positionFrequency.get(pos) + 1);
    //   } else {
    //     positionFrequency.set(pos, 1);
    //   }
    //   const world = state.data.worldHash;
    //   if (worldFrequency.has(world)) {
    //     worldFrequency.set(world, worldFrequency.get(world) + 1);
    //   } else {
    //     worldFrequency.set(world, 1);
    //   }
    // });
    // // console.dir(positionFrequency, {depth: null});

    // const nodeCount = graph.nodes().size();
    // console.log({nodeCount, nodeCountDelta: nodeCount - previousNodeCount, edgeCount: graph.edges().size()});
    // previousNodeCount = nodeCount;
    function* bestPath(startNode: TreeNode) {
      let nextNode = startNode;
      for (; ;) {
        yield nextNode.data;
        nextNode = bestChild(nextNode, 1.0, 0);
        if (nextNode == null) {
          break;
        }
      }
    };

    const response: MCTSResponse = {
      rootNode,
      bestPath: bestPath(rootNode),
    };
    // TODO: find a better way to return the full result set.
    recordCalculationTime();
    controlInput = yield response;
    resetComputationBudget();
    timestep++;

    // TODO: remove this logging or find a better way to enable it.
    if (controlInput.logDetails) {
      logDetails();
      recordCalculationTime();
      controlInput = yield response;
      resetComputationBudget();
    }

    if (controlInput.pruneRootNode) {
      pruneRootNode();
    }
  }
}

// export const monteCarloTreeSearch = (
//   initialState: State,
//   actionGenerator: ActionGenerator,
//   simulateDefaultPolicy: SimulateDefaultPolicy,
//   timeLimitMillis: number,
//   mixmaxFactor: number,
//   explorationFactor: number): Action => {
//   if (explorationFactor <= 0) {
//     throw new Error('explorationFactor must be greater than zero');
//   }
//   const startTime = performance.now();
//   const rootNode: TreeNode = {
//     data: {
//       id: 'root_node',
//       state: initialState,
//       visits: 0,
//       scoreCumulative: 0,
//       scoreMax: 0,
//     },
//     inEdge: undefined,
//     outEdges: []
//   };
//   const actionGeneratorExpandedMap = new Map<string, ActionResultGenerator>();
//   const actionGeneratorCompletedSet = new Set<string>();
//   const transpositionMap = new Map<string, TreeNode>();
// 
//   while (performance.now() - startTime < timeLimitMillis) {
//     const [node, depth] = treePolicy(rootNode, actionGenerator, actionGeneratorExpandedMap, actionGeneratorCompletedSet, transpositionMap, mixmaxFactor, explorationFactor);
//     const reward = simulateDefaultPolicy(rootNode.data.state, node.data.state);
//     backpropogateReward(node, reward);
//     // console.dir(graph.json(), {depth: null});
//   }
// 
//   let nextNode = rootNode;
//   for (; ;) {
//     // console.dir(nextNode, {depth: null});
//     nextNode = bestChild(nextNode, 1.0, 0);
//     if (nextNode == null) {
//       break;
//     }
//   }
//   // console.log({nodeCount: graph.nodes().size(), edgeCount: graph.edges().size()});
//   return bestAction(rootNode, mixmaxFactor);
// }

const treePolicy = (rootNode: TreeNode,
  actionGenerator: ActionGenerator,
  actionGeneratorExpandedMap: Map<string, ActionResultGenerator>,
  actionGeneratorCompletedSet: Set<string>,
  transpositionMap: Map<string, TreeNode>,
  mixmaxFactor: number,
  explorationFactor: number
): [TreeNode, number] => {
  let depth = 0;
  let node: TreeNode = rootNode;
  while (!node.data.state.terminal) {
    depth += 1;
    if (actionGeneratorCompletedSet.has(node.data.id)) {
      const potentialBestChild = bestChild(node, mixmaxFactor, explorationFactor);
      if (potentialBestChild != null) {
        node = potentialBestChild;
      } else {
        node.data.state.terminal = true;
        // console.log('no best child found');
        // console.dir(node, {depth: 4});
      }
    } else {
      let generator: ActionResultGenerator;
      if (actionGeneratorExpandedMap.has(node.data.id)) {
        generator = actionGeneratorExpandedMap.get(node.data.id);
      } else {
        generator = actionGenerator(node.data.state);
        actionGeneratorExpandedMap.set(node.data.id, generator);
      }
      const actionResult = generator.next();
      if (actionResult.done) {
        actionGeneratorCompletedSet.add(node.data.id);
        actionGeneratorExpandedMap.delete(node.data.id);
        const potentialBestChild = bestChild(node, mixmaxFactor, explorationFactor);
        if (potentialBestChild != null) {
          node = potentialBestChild;
        } else {
          node.data.state.terminal = true;
          // console.log('no best child found');
          // console.dir(node, {depth: 4});
        }
      } else {
        const newNode = expandNode(node, actionResult.value);
        return [newNode, depth];
      }
    }
  }
  return [node, depth];
}

const expandNode = (parentNode: TreeNode, actionResult: ActionResult): TreeNode => {
  const node: TreeNode = {
    data: {
      id: uuidv4(),
      state: actionResult.resultState,
      visits: 0,
      scoreCumulative: 0,
      scoreMax: 0,
    },
    inEdge: undefined,
    outEdges: [],
  }
  const edge: TreeEdge = {
    id: uuidv4(),
    source: parentNode,
    target: node,
    action: actionResult.action,
  }
  parentNode.outEdges.push(edge);
  node.inEdge = edge;

  return node;
}

export const bestChild = (node: TreeNode, mixmaxFactor: number, explorationFactor: number): TreeNode | undefined => {
  const nodeVisits = node.data.visits;
  const logNodeVisits = 2 * Math.log(nodeVisits);
  let maxNode: TreeNode;
  let maxNodeValue: number;
  for (const edge of node.outEdges) {
    const targetNode = edge.target;
    const explotation = mixmaxFactor * targetNode.data.scoreMax + (1 - mixmaxFactor) * (targetNode.data.scoreCumulative / targetNode.data.visits);
    const targetValue = explotation + 2 * explorationFactor * Math.sqrt(logNodeVisits / targetNode.data.visits);
    if (maxNodeValue == null || maxNodeValue < targetValue) {
      maxNode = targetNode;
      maxNodeValue = targetValue;
    }
  }

  return maxNode;
}

const backpropogateReward = (node: TreeNode, reward: number) => {
  let previousNode: TreeNode;
  let cursorNode = node;
  try {
    while (cursorNode != null) {
      const visitCount = cursorNode.data.visits + 1;
      const scoreCumulative = cursorNode.data.scoreCumulative + reward;
      cursorNode.data.visits = visitCount;
      cursorNode.data.scoreCumulative = scoreCumulative;
      let maxBackprop: number;
      if (cursorNode.outEdges.length === 0) {
        maxBackprop = reward;
        //  maxBackprop = scoreCumulative / visitCount;
      } else {
        maxBackprop = cursorNode.outEdges.reduce((max: number, e: TreeEdge) => {
          return Math.max(max, e.target.data.scoreMax);
        }, 0);
      }
      // cursorNode.data.scoreMax = Math.max(maxBackprop, cursorNode.data.scoreMax);
      cursorNode.data.scoreMax = maxBackprop;
      previousNode = cursorNode;
      cursorNode = cursorNode.inEdge?.source;
    }
  } catch (e) {
    console.log({previousNode, cursorNode, e});
    throw e;
  }
}

const bestAction = (node: TreeNode, mixmaxFactor: number): Action => {
  // Set explorationFactor to 0 as per Upper Confidence Bounds for Trees (UCT)
  // Set mixmaxFactor to 1 to get the best nodes
  const bestChildNode = bestChild(node, 1.0, 0);
  const bestActionEdge = node.outEdges.find((edge) => edge.target.data.id === bestChildNode.data.id);
  return bestActionEdge.action;
}
