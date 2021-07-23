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
  const depthMap = new Map<number, number>();
  let returnBestNode = false;
  let previousNodeCount = 0;

  for (; ;) {
    const startTime = performance.now();
    while (performance.now() - startTime < timeLimitMillis) {
      const [node, depth] = treePolicy(rootNode, actionGenerator, actionGeneratorExpandedMap, explorationFactor);
      const reward = simulateDefaultPolicy(rootNode.data.state, node.data.state);
      backpropogateReward(node, reward);
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
    // console.dir(worldFrequency, {depth: null});
    console.dir(depthMap, {depth: null});

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

  while (performance.now() - startTime < timeLimitMillis) {
    const [node, depth] = treePolicy(rootNode, actionGenerator, actionGeneratorExpandedMap, explorationFactor);
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

const treePolicy = (rootNode: TreeNode, actionGenerator: ActionGenerator, actionGeneratorExpandedMap: Map<string, ActionResultGenerator>, explorationFactor: number): [TreeNode, number] => {
  let depth = 0;
  let node: TreeNode = rootNode;
  while (!node.data.state.terminal) {
    depth += 1;
    let generator: ActionResultGenerator;
    if (actionGeneratorExpandedMap.has(node.data.id)) {
      generator = actionGeneratorExpandedMap.get(node.data.id);
    } else {
      generator = actionGenerator(node.data.state);
      actionGeneratorExpandedMap.set(node.data.id, generator);
    }
    const actionResult = generator.next();
    if (actionResult.done) {
      const potentialBestChild = bestChild(node, explorationFactor);
      if (potentialBestChild != null) {

        // console.log('search_string');
        // console.dir(nodeData, {depth: null});
        // console.dir(potentialBestChild, {depth: null});
        node = potentialBestChild;
      } else {
        console.log('no best child found');
        console.dir(node, {depth: null});
      }
      // TODO: should this return early or mark the state as terminal if no child nodes exist?
    } else {
      return [expandNode(node, actionResult.value), depth];
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
  let maxNode: TreeNode;
  let maxNodeValue: number;
  for (const edge of node.outEdges) {
    const targetNode = edge.target;
    const targetValue = targetNode.data.scoreMax + explorationFactor * Math.sqrt(2 * Math.log(nodeVisits) / targetNode.data.visits);
    if (maxNodeValue == null || maxNodeValue < targetValue) {
      maxNode = targetNode;
      maxNodeValue = targetValue;
    }
  }

  return maxNode;
}

const backpropogateReward = (node: TreeNode, reward: number) => {
  let cursorNode = node;
  let maxBackprop = 0;
  while (cursorNode != null) {
    const visitCount = cursorNode.data.visits + 1;
    const scoreCumulative = cursorNode.data.scoreCumulative + reward;
    cursorNode.data.visits = visitCount;
    cursorNode.data.scoreCumulative = scoreCumulative;
    const outDegree = cursorNode.outEdges.length;
    maxBackprop = Math.max(maxBackprop, outDegree === 0 ? scoreCumulative / visitCount : cursorNode.data.scoreMax);
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
