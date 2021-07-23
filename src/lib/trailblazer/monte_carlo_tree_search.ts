import cytoscape, {Core} from 'cytoscape';
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
  group: 'nodes';
  data: TreeNodeData;
}

export type Action = {
  data: any;
}

type TreeEdge = {
  group: 'edges'
  data: {
    id: string;
    source: string;
    target: string;
    action: Action;
  }
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
    group: 'nodes',
    data: {
      id: 'root_node',
      state: initialState,
      visits: 0,
      scoreCumulative: 0,
      scoreMax: 0,
    }
  };
  const graph = cytoscape();
  graph.add(rootNode);
  const actionGeneratorExpandedMap = new Map<string, ActionResultGenerator>();
  const depthMap = new Map<number, number>();
  let returnBestNode = false;
  let previousNodeCount = 0;

  for (; ;) {
    const startTime = performance.now();
    while (performance.now() - startTime < timeLimitMillis) {
      const [nodeData, depth] = treePolicy(graph, rootNode, actionGenerator, actionGeneratorExpandedMap, explorationFactor);
      const reward = simulateDefaultPolicy(rootNode.data.state, nodeData.state);
      backpropogateReward(graph, nodeData, reward);
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

    const nodeCount = graph.nodes().size();
    console.log({nodeCount, nodeCountDelta: nodeCount - previousNodeCount, edgeCount: graph.edges().size()});
    previousNodeCount = nodeCount;

    returnBestNode = yield returnBestNode ? bestAction(graph, rootNode.data) : undefined;

    // TODO: remove this logging or find a better way to enable it.
    if (returnBestNode) {
      let nextNodeData = rootNode.data;
      for (; ;) {
        console.dir(nextNodeData, {depth: null});
        nextNodeData = bestChild(graph, nextNodeData, 0);
        if (nextNodeData == null) {
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
    group: 'nodes',
    data: {
      id: 'root_node',
      state: initialState,
      visits: 0,
      scoreCumulative: 0,
      scoreMax: 0,
    }
  };
  const graph = cytoscape();
  graph.add(rootNode);
  const actionGeneratorExpandedMap = new Map<string, ActionResultGenerator>();

  while (performance.now() - startTime < timeLimitMillis) {
    const [nodeData, depth] = treePolicy(graph, rootNode, actionGenerator, actionGeneratorExpandedMap, explorationFactor);
    const reward = simulateDefaultPolicy(rootNode.data.state, nodeData.state);
    backpropogateReward(graph, nodeData, reward);
    // console.dir(graph.json(), {depth: null});
  }

  const positionFrequency = new Map<string, number>();
  graph.nodes().forEach((element) => {
    const state = element.data('state');
    const pos = `x:${state.data.x},y:${state.data.y},z:${state.data.z}`;
    if (positionFrequency.has(pos)) {
      positionFrequency.set(pos, positionFrequency.get(pos) + 1);
    } else {
      positionFrequency.set(pos, 1);
    }
  });
  console.dir(positionFrequency, {depth: null});

  let nextNodeData = rootNode.data;
  for (; ;) {
    console.dir(nextNodeData, {depth: null});
    nextNodeData = bestChild(graph, nextNodeData, 0);
    if (nextNodeData == null) {
      break;
    }
  }
  console.log({nodeCount: graph.nodes().size(), edgeCount: graph.edges().size()});
  return bestAction(graph, rootNode.data);
}

const treePolicy = (graph: Core, rootNode: TreeNode, actionGenerator: ActionGenerator, actionGeneratorExpandedMap: Map<string, ActionResultGenerator>, explorationFactor: number): [TreeNodeData, number] => {
  let depth = 0;
  const rootElement = graph.getElementById(rootNode.data.id);
  let nodeData: TreeNodeData = rootElement.data();
  while (!nodeData.state.terminal) {
    depth += 1;
    let generator: ActionResultGenerator;
    if (actionGeneratorExpandedMap.has(nodeData.id)) {
      generator = actionGeneratorExpandedMap.get(nodeData.id);
    } else {
      generator = actionGenerator(nodeData.state);
      actionGeneratorExpandedMap.set(nodeData.id, generator);
    }
    const actionResult = generator.next();
    if (actionResult.done) {
      const potentialBestChild = bestChild(graph, nodeData, explorationFactor);
      if (potentialBestChild != null) {

        // console.log('search_string');
        // console.dir(nodeData, {depth: null});
        // console.dir(potentialBestChild, {depth: null});
        nodeData = potentialBestChild;
      } else {
        console.log('no best child found');
        console.dir(nodeData, {depth: null});
      }
      // TODO: should this return early or mark the state as terminal if no child nodes exist?
    } else {
      return [expandNode(graph, nodeData, actionResult.value), depth];
    }
  }
  return [nodeData, depth];
}

const expandNode = (graph: Core, parentNode: TreeNodeData, actionResult: ActionResult): TreeNodeData => {
  const node: TreeNode = {
    group: 'nodes',
    data: {
      id: uuidv4(),
      state: actionResult.resultState,
      visits: 0,
      scoreCumulative: 0,
      scoreMax: 0,
    }
  }
  const edge: TreeEdge = {
    group: 'edges',
    data: {
      id: uuidv4(),
      source: parentNode.id,
      target: node.data.id,
      action: actionResult.action,
    }
  }
  graph.add([node, edge]);

  return node.data;
}

const bestChild = (graph: Core, nodeData: TreeNodeData, explorationFactor: number): TreeNodeData | undefined => {
  const nodeElement = graph.getElementById(nodeData.id);
  if (nodeElement.size() === 0) {
    return;
  }
  const nodeVisits = nodeElement.data('visits');
  const {ele} = nodeElement.outgoers('node').max((element) => {
    if (element == null) {
      // TODO: find out why this sometimes yields undefined elements.
      return 0;
    }
    const elementVisits = element.data('visits');
    // average
    //  return (element.data('scoreCumulative') / elementVisits) + explorationFactor * Math.sqrt(2 * Math.log(nodeVisits) / elementVisits);
    // direct score
    return element.data('scoreMax') + explorationFactor * Math.sqrt(2 * Math.log(nodeVisits) / elementVisits);
  });

  return ele?.data();
}

const backpropogateReward = (graph: Core, nodeData: TreeNodeData, reward: number) => {
  let cursorNode = graph.getElementById(nodeData.id);
  let maxBackprop = 0;
  while (cursorNode.size() == 1) {
    const visitCount = cursorNode.data('visits') + 1;
    const scoreCumulative = cursorNode.data('scoreCumulative') + reward;
    cursorNode.data('visits', visitCount);
    cursorNode.data('scoreCumulative', scoreCumulative);
    const outDegree = cursorNode.outdegree(false);
    maxBackprop = Math.max(maxBackprop, outDegree === 0 ? scoreCumulative / visitCount : cursorNode.data('scoreMax'));
    cursorNode.data('scoreMax', maxBackprop);
    cursorNode = cursorNode.incomers('node')
  }
}

const bestAction = (graph: Core, nodeData: TreeNodeData): Action => {
  // Set explorationFactor to 0 as per Upper Confidence Bounds for Trees (UCT)
  const bestChildNodeData = bestChild(graph, nodeData, 0);
  // TODO: this is slow. Make it faster.
  const bestActionEdge = graph.edges().filter((e) => e.source().id() === nodeData.id && e.target().id() === bestChildNodeData.id);
  return bestActionEdge.data();
}
