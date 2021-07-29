import {performance} from 'perf_hooks';
import {v4 as uuidv4} from 'uuid';

export type State = {
  data: any;
  costToCome: number;
  terminal: boolean;
}

type TreeNodeData = {
  id: string;
  state: State;
  visits: number;
  scoreCumulative: number;
  scoreMax: number;
}

type TreeNode = {
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
export type SimulateDefaultPolicy = (startState: State, endState: State) => number;

export function* itterativeMCTS(
  initialState: State,
  actionGenerator: ActionGenerator,
  simulateDefaultPolicy: SimulateDefaultPolicy,
  timeLimitMillis: number,
  explorationFactor: number) {
  if (explorationFactor <= 0) {
    throw new Error('explorationFactor must be greater than zero');
  }
  const rootNode: TreeNode = {
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
  const actionGeneratorExpandedMap = new Map<string, ActionResultGenerator>();
  const actionGeneratorCompletedSet = new Set<string>();
  const depthMap = new Map<number, number>();
  let returnBestNode = false;
  let newNodeCount = 0;
  let previousNodeCount = 0;
  let betterScoreNodeFound = 0;
  let betterPathFound = [];
  let worseScoreNodeFound = 0;
  const transpositionMap = new Map<string, TreeNode>();
  const clampReward = (n: TreeNode, reward: number): number => {
    const hash = n.data.state.data.posHash;
    const previousNode = transpositionMap.get(hash);
    if (previousNode != null) {
      const percentReduction = (previousNode.data.state.costToCome - n.data.state.costToCome) / previousNode.data.state.costToCome;
      if (percentReduction < 0.05) {
        // TODO: don't expose this deep knowlege here
        // const edgeId = n.inEdge.id;
        //const index = n.inEdge.source.outEdges.findIndex((e: TreeEdge) => e.id === edgeId);
        // if (index !== -1) {
        worseScoreNodeFound += 1;
        // const edgeIdsBefore = n.inEdge.source.outEdges.map((e: TreeEdge) => e.id);
        // n.inEdge.source.outEdges.splice(index, 1);
        // const edgeIdsAfter = n.inEdge.source.outEdges.map((e: TreeEdge) => e.id);
        // console.log({edgeId, edgeIdsBefore, edgeIdsAfter});
        // n.data.state.terminal = true;
        return 0;
      }
    }
    return reward;
  }
  const pruneNode = (n: TreeNode) => {
    const hash = n.data.state.data.posHash;
    const previousNode = transpositionMap.get(hash);
    if (previousNode != null) {
      previousNodeCount += 1;
      const percentReduction = (previousNode.data.state.costToCome - n.data.state.costToCome) / previousNode.data.state.costToCome;
      if (percentReduction > 0.05) {
        betterScoreNodeFound += 1;
        betterPathFound.push({
          previousCost: previousNode.data.state.costToCome,
          newCost: n.data.state.costToCome,
          percentReduction,
        });
        transpositionMap.set(hash, n);
        // previousNode.data.state.terminal = true;
        // backpropogateReward(previousNode, 0);
      }
    } else {
      newNodeCount += 1;
      transpositionMap.set(hash, n);
    }
  }
  const worldFrequency = new Map<string, number>();
  const countWorld = (n: TreeNode) => {
    const hash = n.data.state.data.hash;
    if (worldFrequency.has(hash)) {
      worldFrequency.set(hash, worldFrequency.get(hash) + 1);
    } else {
      worldFrequency.set(hash, 1);
    }
  }

  for (; ;) {
    const startTime = performance.now();
    while (performance.now() - startTime < timeLimitMillis) {
      const [node, depth] = treePolicy(rootNode, actionGenerator, actionGeneratorExpandedMap, actionGeneratorCompletedSet, transpositionMap, explorationFactor);
      // countWorld(node);
      const reward = simulateDefaultPolicy(rootNode.data.state, node.data.state);
      const clampedReward = clampReward(node, reward);
      backpropogateReward(node, clampedReward);
      pruneNode(node);
      // console.dir(graph.json(), {depth: null});
      depthMap.set(depth, depthMap.has(depth) ? depthMap.get(depth) + 1 : 1);
    }
    // const worldFrequency = new Map<string, number>();
    // const positionFrequency = new Map<string, number>();
    // graph.nodes().forEach((element) => {
    //   const state = element.data('state');
    //   // const pos = `x:${state.data.x},y:${state.data.y},z:${state.data.z}`;
    //   const pos = state.data.hash;
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

    returnBestNode = yield returnBestNode ? bestAction(rootNode) : undefined;

    // TODO: remove this logging or find a better way to enable it.
    if (returnBestNode) {
      let nextNode = rootNode;
      for (; ;) {
        console.dir(nextNode.data, {depth: null});
        nextNode = bestChild(nextNode, 0);
        if (nextNode == null) {
          break;
        }
      }
      // console.dir(worldFrequency, {depth: null});
      console.dir(depthMap, {depth: null});
      // console.dir(betterPathFound, {depth: null});
      console.log({previousNodeCount, newNodeCount, betterScoreNodeFound, worseScoreNodeFound, totalNodes: previousNodeCount + newNodeCount});
    }
  }
}

export const monteCarloTreeSearch = (
  initialState: State,
  actionGenerator: ActionGenerator,
  simulateDefaultPolicy: SimulateDefaultPolicy,
  timeLimitMillis: number,
  explorationFactor: number): Action => {
  if (explorationFactor <= 0) {
    throw new Error('explorationFactor must be greater than zero');
  }
  const startTime = performance.now();
  const rootNode: TreeNode = {
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
  const actionGeneratorExpandedMap = new Map<string, ActionResultGenerator>();
  const actionGeneratorCompletedSet = new Set<string>();
  const transpositionMap = new Map<string, TreeNode>();

  while (performance.now() - startTime < timeLimitMillis) {
    const [node, depth] = treePolicy(rootNode, actionGenerator, actionGeneratorExpandedMap, actionGeneratorCompletedSet, transpositionMap, explorationFactor);
    const reward = simulateDefaultPolicy(rootNode.data.state, node.data.state);
    backpropogateReward(node, reward);
    // console.dir(graph.json(), {depth: null});
  }

  let nextNode = rootNode;
  for (; ;) {
    console.dir(nextNode, {depth: null});
    nextNode = bestChild(nextNode, 0);
    if (nextNode == null) {
      break;
    }
  }
  // console.log({nodeCount: graph.nodes().size(), edgeCount: graph.edges().size()});
  return bestAction(rootNode);
}

const treePolicy = (rootNode: TreeNode, actionGenerator: ActionGenerator, actionGeneratorExpandedMap: Map<string, ActionResultGenerator>, actionGeneratorCompletedSet: Set<string>, transpositionMap: Map<string, TreeNode>, explorationFactor: number): [TreeNode, number] => {
  let depth = 0;
  let node: TreeNode = rootNode;
  while (!node.data.state.terminal) {
    depth += 1;
    if (actionGeneratorCompletedSet.has(node.data.id)) {
      const potentialBestChild = bestChild(node, explorationFactor);
      if (potentialBestChild != null) {
        node = potentialBestChild;
      } else {
        node.data.state.terminal = true;
        console.log('no best child found');
        console.dir(node, {depth: 4});
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
        const potentialBestChild = bestChild(node, explorationFactor);
        if (potentialBestChild != null) {
          node = potentialBestChild;
        } else {
          node.data.state.terminal = true;
          console.log('no best child found');
          console.dir(node, {depth: 4});
        }
      } else {
        return [expandNode(node, actionResult.value), depth];
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

const bestChild = (node: TreeNode, explorationFactor: number): TreeNode | undefined => {
  const nodeVisits = node.data.visits;
  const logNodeVisists = 2 * Math.log(nodeVisits);
  let maxNode: TreeNode;
  let maxNodeValue: number;
  for (const edge of node.outEdges) {
    const targetNode = edge.target;
    const targetValue = targetNode.data.scoreMax + explorationFactor * Math.sqrt(logNodeVisists / targetNode.data.visits);
    if (maxNodeValue == null || maxNodeValue < targetValue) {
      maxNode = targetNode;
      maxNodeValue = targetValue;
    }
  }

  return maxNode;
}

const backpropogateReward = (node: TreeNode, reward: number) => {
  let cursorNode = node;
  while (cursorNode != null) {
    const visitCount = cursorNode.data.visits + 1;
    const scoreCumulative = cursorNode.data.scoreCumulative + reward;
    cursorNode.data.visits = visitCount;
    cursorNode.data.scoreCumulative = scoreCumulative;
    let maxBackprop: number;
    if (cursorNode.outEdges.length === 0) {
      maxBackprop = scoreCumulative / visitCount;
    } else {
      maxBackprop = cursorNode.outEdges.reduce((max: number, e: TreeEdge) => {
        return Math.max(max, e.target.data.scoreMax);
      }, 0);
    }
    cursorNode.data.scoreMax = maxBackprop;
    cursorNode = cursorNode.inEdge?.source;
  }
}

const bestAction = (node: TreeNode): Action => {
  // Set explorationFactor to 0 as per Upper Confidence Bounds for Trees (UCT)
  const bestChildNode = bestChild(node, 0);
  const bestActionEdge = node.outEdges.find((edge) => edge.target.data.id === bestChildNode.data.id);
  return bestActionEdge.action;
}
