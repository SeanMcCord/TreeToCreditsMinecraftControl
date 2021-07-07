import createGraph, {Graph} from "ngraph.graph"
import Heap from "mnemonist/heap.js";
import Queue from "mnemonist/queue.js";

// Optimal Kinodynamic Motion Planning using Incremental Sampling-based Methods
// http://amav.gatech.edu/sites/default/files/papers/cdc2010.Karaman.Frazzoli.printed.pdf

type Vertex = {
  id: string;
  cost: number;
  config: Configuration;
}

export type Obstacle = {
  id: string;
  low: Configuration;
  high: Configuration;
}

export type Configuration = Array<number>;

export const cloneGraph = (graph: Graph): Graph => {
  const clone = createGraph();
  graph.forEachNode((node: any) => {
    clone.addNode(
      node.id,
      {cost: node.data.cost, config: [...node.data.config]}
    );
  });
  graph.forEachLink((link: any) => {
    clone.addLink(
      link.fromId,
      link.toId,
    );
  });
  return clone;
}

export type FlatGraph = {
  nodes: Array<Vertex>;
  links: Array<[string, string]>;
}

export const serializeGraph = (graph: Graph): FlatGraph => {
  const flatGraph: FlatGraph = {nodes: [], links: []};
  graph.forEachNode((node: any) => {
    flatGraph.nodes.push({
      id: node.id,
      cost: node.data.cost,
      config: [...node.data.config]
    });
  });
  graph.forEachLink((link: any) => {
    flatGraph.links.push([
      link.fromId,
      link.toId,
    ]);
  });
  return flatGraph;
}

export const deserializeGraph = (graph: FlatGraph): Graph => {
  const clone = createGraph();
  graph.nodes.forEach((vertex: Vertex) => {
    clone.addNode(
      vertex.id,
      {cost: vertex.cost, config: [...vertex.config]}
    );
  });
  graph.links.forEach((link: [string, string]) => {
    clone.addLink(
      link[0],
      link[1],
    );
  });
  return clone;
}

// Returns a three vector
// TODO: assumes config is in 3 space. Allow for n dimensions
export const randomConfiguration = (): Configuration => {
  // return [(Math.random() * 6) - 3, (Math.random() * 6) - 3, (Math.random() * 6) - 3];
  // TODO: elevate the size of the sample space
  return [(Math.random() * 500) - 250, 0, (Math.random() * 500) - 250];
}

const sampleConfiguration = (goalConfig: Configuration, configCollides: ConfigurationCollides): Configuration => {
  // TODO: expose this value for use tuning
  const goalProbability = 0.05;
  // TODO: Add a max retry for randomConfig colliding. Right now it may enter a infinite loop if no config exists.
  // It also may take a very long time if the space is heavily constrained.
  let randomConfig: Configuration;
  if (Math.random() < goalProbability) {
    // Assume goal is not in obstacle
    // TODO: if obstacles are allowed to move, this may be a bad assumption.
    randomConfig = [...goalConfig];
  } else {
    for (; ;) {
      randomConfig = randomConfiguration();
      if (!configCollides(randomConfig)) {
        break;
      }
    }
  }
  return randomConfig;
}

// TODO: make this an ordered list of some sort
export const linksBackToRootNode = (graph: Graph, vertexId: string): Set<string> => {
  const links = new Set<string>();
  const queue = new Queue<string>();
  const visited = new Set<string>();
  queue.enqueue(vertexId);
  while (queue.size > 0) {
    const toId = queue.dequeue();
    if (toId == null) {
      throw new Error("value from queue was null");
    }
    if (visited.has(toId)) {
      continue;
    }
    visited.add(toId);
    graph.forEachLinkedNode(
      toId,
      (_, link) => {
        if (link.toId !== toId) {
          return;
        }
        queue.enqueue(String(link.fromId));
        links.add(link.id);
      },
      false // look at all linked nodes
    );
  }
  return links;
}

// Throws error if no node is found nearby.
// TODO: assumes config is in 3 space. Allow for n dimensions
// TODO: use a better search structure such as a kd-tree.
// Current O(n) time
// kd-tree O(logn) time
const findNearestVertex = (config: Configuration, graph: Graph): Vertex => {
  let nearestVertexDistance = Number.POSITIVE_INFINITY;
  let nearestVertex: Vertex;
  graph.forEachNode((node: any) => {
    const nodeConfig = node.data.config;
    const distance = Math.sqrt(
      Math.pow(config[0] - nodeConfig[0], 2) +
      Math.pow(config[1] - nodeConfig[1], 2) +
      Math.pow(config[2] - nodeConfig[2], 2)
    );
    if (distance < nearestVertexDistance) {
      nearestVertexDistance = distance;
      nearestVertex = {id: node.id, cost: node.data.cost, config: nodeConfig};
    }
  });
  if (nearestVertex == null) {
    // This should not happen
    throw new Error("Could not find vertex near random config");
  }
  return nearestVertex;
}

// TODO: assumes config is in 3 space. Allow for n dimensions
// TODO: consider using kd-trees or another data structure to improve speed
// Current O(nlogn) time
// look into https://en.wikipedia.org/wiki/Best_bin_first
// Recent work with binary field support https://open.library.ubc.ca/media/download/pdf/24/1.0052198/2/791
const findNearbyVertices = (graph: Graph, config: Configuration): Array<Vertex> => {
  type VertexHeapElement = {
    distance: number;
    vertex: Vertex;
  }
  // TODO: elevate this to allow users to specifiy the value
  // planning constant
  const gamma = 50;
  // TODO: set this to the correct value for the given graph.
  const dimensons = 3;
  const count = graph.getNodeCount();
  const radius = gamma * Math.pow(Math.log10(count) / count, 1 / dimensons);

  const heap = new Heap<VertexHeapElement>((a, b) => {
    if (a.distance < b.distance) {
      return 1;
    }
    if (a.distance > b.distance) {
      return -1;
    }
    return 0;
  });
  graph.forEachNode((node: any) => {
    const vertex = {
      id: node.id,
      cost: node.data.cost,
      config: node.data.config,
    }
    const distance = Math.sqrt(
      Math.pow(config[0] - vertex.config[0], 2) +
      Math.pow(config[1] - vertex.config[1], 2) +
      Math.pow(config[2] - vertex.config[2], 2)
    );
    if (distance < 0.0001) {
      // console.log({links: node.links, config, vertex});
      throw new Error("Node already exists");
    }
    if (distance > radius) {
      return;
    } else {
      heap.push({distance, vertex});
    }
  });
  const elements = heap.consume();
  const vertices: Array<Vertex> = elements.map(e => e.vertex);
  // const distances: Array<number> = elements.map(e => e.distance);
  if (Math.random() > 0.0) {
    // console.log({radius, distances, vertices});
  }
  return vertices;
}

// Return true if there is a collision.
export type ConfigurationCollides = (configuration: Configuration) => boolean;
export type ConfigurationPathCollides = (configurations: Array<Configuration>) => boolean;

export const createHypercubeCollides = (obstacles: Array<Obstacle>): ConfigurationCollides => {
  return (configuration: Configuration): boolean => {
    for (const obstacle of obstacles) {
      // TODO: there is probably a faster way to do this.
      // TODO: support n-dimensional hypercubes
      if ((configuration[0] >= obstacle.low[0] && configuration[0] <= obstacle.high[0]) &&
        (configuration[1] >= obstacle.low[1] && configuration[1] <= obstacle.high[1]) &&
        (configuration[2] >= obstacle.low[2] && configuration[2] <= obstacle.high[2])) {
        return true;
      }
    }
    return false;
  };
}

export const createHypercubePathCollides = (obstacles: Array<Obstacle>, configCollides: ConfigurationCollides): ConfigurationPathCollides => {
  return (configurations: Array<Configuration>): boolean => {
    // TODO: implement this fully
    for (const config of configurations) {
      if (configCollides(config)) {
        return true;
      }
    }
    // TODO: add checks that the path between configurations is valid
    return false;
  }
}

export const generateObstacle = (id: string): Obstacle => {
  const a = randomConfiguration();
  const b = randomConfiguration();
  const low: Array<number> = [];
  const high: Array<number> = [];
  a.forEach((_, i) => {
    if (a[i] > b[i]) {
      low.push(b[i]);
      high.push(a[i]);
    } else {
      low.push(a[i]);
      high.push(b[i]);
    }
  });
  return {id, low, high};
}

// TODO: assumes config is in 3 space. Allow for n dimensions
// TODO: remove threejs vector
const newConfiguration = (nearestVertex: Vertex, randomConfig: Configuration, incDistance: number): Configuration => {
  // holonomic uses randomConfig
  // return randomConfig;
  // TODO: optimize this math
  // console.log(nearestVertex, randomConfig, incDistance)
  const nearConfig = nearestVertex.config;
  const dir = [randomConfig[0] - nearConfig[0], randomConfig[1] - nearConfig[1], randomConfig[2] - nearConfig[2]];
  const dirLength = Math.sqrt(
    Math.pow(dir[0], 2) +
    Math.pow(dir[1], 2) +
    Math.pow(dir[2], 2)
  );
  dir.forEach((component, index) => dir[index] = component / dirLength);
  dir.forEach((component, index) => dir[index] = component * incDistance);
  dir.forEach((component, index) => dir[index] = component + nearConfig[index]);
  return dir;
}

// TODO: assumes config is in 3 space. Allow for n dimensions
export const goalReached = (config: Configuration, goalConfig: Configuration, incDistance: number): boolean => {
  // This is duplicated from estimateCost as the esimation method may change. This should be absolute
  const distance = Math.sqrt(
    Math.pow(config[0] - goalConfig[0], 2) +
    Math.pow(config[1] - goalConfig[1], 2) +
    Math.pow(config[2] - goalConfig[2], 2)
  );
  // TODO: allow this to be set differently
  return distance < incDistance;
}

// TODO: assumes config is in 3 space. Allow for n dimensions
const estimateCost = (fromConfig: Configuration, toConfig: Configuration): number => {
  const distance = Math.sqrt(
    Math.pow(toConfig[0] - fromConfig[0], 2) +
    Math.pow(toConfig[1] - fromConfig[1], 2) +
    Math.pow(toConfig[2] - fromConfig[2], 2)
  );
  return distance;
}

// Add newV to graph and add edge from currentV to newV. Also adds the cost estimate
const addNode = (currentV: Vertex | undefined, newV: Vertex, graph: Graph): Vertex => {
  if (graph.hasNode(newV.id)) {
    console.log("!!!!!!!!Attempted to add existing node");
    console.log({newV});
    throw new Error("don't add the same node");
  }
  let cost = 0;
  if (currentV != null) {
    if (currentV.config[0] === newV.config[0] && currentV.config[1] === newV.config[1] && currentV.config[2] === newV.config[2]) {
      console.log('same position attempted to be added');
      console.dir({currentV, newV});
      throw new Error("don't add the same node");
    }
    cost = currentV.cost + estimateCost(currentV.config, newV.config);
  }
  graph.addNode(
    newV.id,
    {cost, config: [...newV.config]}
  );
  if (currentV != null) {
    if (currentV.id === newV.id) {
      console.log('same id attempted to be added');
      console.log(newV.id);
    }
    graph.addLink(currentV.id, newV.id);
  }
  return {id: newV.id, cost, config: [...newV.config]};
}

const reconnect = (fromVertex: Vertex, toVertex: Vertex, graph: Graph) => {
  // remove link from previous parent to toVertex
  graph.forEachLinkedNode(
    toVertex.id,
    (_, link) => {
      if (link.toId === toVertex.id) {
        graph.removeLink(link);
      }
    },
    false // look at all linked nodes
  );
  graph.addLink(fromVertex.id, toVertex.id);

  const cost = fromVertex.cost + estimateCost(fromVertex.config, toVertex.config);
  graph.addNode(
    toVertex.id,
    {cost, config: [...toVertex.config]}
  );
  propogateCostDownward(graph, toVertex.id);
}

// TODO: might be able to remove the need for this if the cost of a move is stored in the edge.
// TODO: make this only update the children of a given node
// Current O(n) time
const propogateCostDownward = (graph: Graph, vertexId: string) => {
  const queue = new Queue<string>();
  const visited = new Set<string>();
  queue.enqueue(vertexId);
  while (queue.size > 0) {
    const fromId = queue.dequeue();
    if (fromId == null) {
      throw new Error("value from queue was null");
    }
    if (visited.has(fromId)) {
      continue;
    }
    const fromNode = graph.getNode(fromId);
    visited.add(fromId);
    graph.forEachLinkedNode(
      fromId,
      (toNode) => {
        queue.enqueue(String(toNode.id));
        if (fromNode == null) {
          throw new Error("value from queue was null");
        }
        const cost = fromNode.data.cost + estimateCost(fromNode.data.config, toNode.data.config);
        graph.addNode(
          toNode.id,
          {cost, config: [...toNode.data.config]}
        );
      },
      true // Only look at outbound nodes
    );
  }
}

const chooseParent = (nearbyVertices: Array<Vertex>,
  nearestVertex: Vertex,
  config: Configuration,
  pathCollides: ConfigurationPathCollides,
  incDistance: number): Vertex => {
  const newConfigCost = nearestVertex.cost + estimateCost(nearestVertex.config, config);
  let minVertex = nearestVertex;
  let costMin = newConfigCost;
  nearbyVertices.forEach((nearbyVertex) => {
    if (!pathCollides([nearbyVertex.config, config])) {
      const deltaCost = estimateCost(nearbyVertex.config, config);
      const cost = nearbyVertex.cost + deltaCost;
      if (cost < newConfigCost && cost < costMin && deltaCost < incDistance * 4) {
        minVertex = nearbyVertex;
        costMin = cost;
      }
    }
  });
  return minVertex;
}

const reWire = (graph: Graph,
  nearbyVertices: Array<Vertex>,
  minVertex: Vertex,
  newVertex: Vertex,
  pathCollides: ConfigurationPathCollides,
  incDistance: number): Graph => {
  // TODO: elevate this value out to allow users to specify it.
  nearbyVertices.forEach((nearbyVertex) => {
    if (nearbyVertex.id === minVertex.id) {
      return;
    }
    if (!pathCollides([nearbyVertex.config, newVertex.config]) &&
      (newVertex.cost + estimateCost(newVertex.config, nearbyVertex.config) < nearbyVertex.cost) &&
      (estimateCost(newVertex.config, nearbyVertex.config) < incDistance * 4)) {
      reconnect(newVertex, nearbyVertex, graph);
    }
  });
  return graph;
}

const pruneNodes = (graph: Graph, configCollides: ConfigurationCollides): Graph => {
  const queue = new Queue<string>();
  graph.forEachNode((node) => {
    if (!configCollides(node.data.config)) {
      return;
    }
    queue.enqueue(String(node.id));
  });
  const visited = new Set<string>();
  while (queue.size > 0) {
    const fromId = queue.dequeue();
    if (fromId == null) {
      throw new Error("value from queue was null");
    }
    if (visited.has(fromId)) {
      continue;
    }
    visited.add(fromId);
    graph.forEachLinkedNode(
      fromId,
      (toNode) => {
        queue.enqueue(String(toNode.id));
      },
      true // Only look at outbound nodes
    );
    graph.removeNode(fromId);
  }
  return graph;
}

export const rrtStar = (initConfig: Configuration,
  goalConfig: Configuration,
  configCollides: ConfigurationCollides,
  pathCollides: ConfigurationPathCollides,
  vertexCount: number,
  incDistance: number): Graph => {
  const graph = createGraph();
  addNode(undefined, {id: 'initial_config', cost: 0, config: initConfig}, graph);
  return rrtStarMainWork(graph, goalConfig, configCollides, pathCollides, vertexCount, incDistance);
}

export const rrtStarExtend = (graph: Graph,
  goalConfig: Configuration,
  configCollides: ConfigurationCollides,
  pathCollides: ConfigurationPathCollides,
  vertexCount: number,
  incDistance: number): Graph => {
  return rrtStarMainWork(graph, goalConfig, configCollides, pathCollides, vertexCount, incDistance);
}

const rrtStarMainWork = (graph: Graph,
  goalConfig: Configuration,
  configCollides: ConfigurationCollides,
  pathCollides: ConfigurationPathCollides,
  vertexCount: number,
  incDistance: number): Graph => {
  let nodeCount = graph.getNodeCount();
  pruneNodes(graph, configCollides);
  for (let i = 0; i < vertexCount; i++) {
    const randomConfig = sampleConfiguration(goalConfig, configCollides);
    // console.log({randomConfig});
    const nearestVertex = findNearestVertex(randomConfig, graph);
    // console.log({nearestVertex});
    // Skipping steer function and assuming straight line paths for now.
    // TODO: confirm if newConfiguration should ensure the new configuration avoids obstacles
    const newConfig = newConfiguration(nearestVertex, randomConfig, incDistance);
    if (pathCollides([nearestVertex.config, newConfig])) {
      continue;
    }
    // console.log({newConfig});
    let nearbyVertices: Array<Vertex>;
    try {
      nearbyVertices = findNearbyVertices(graph, newConfig);
    } catch (e) {
      // console.log({randomConfig, nearestVertex, newConfig});
      continue;
      // throw (e);
    }
    // console.log({nearbyVertices});
    const minVertex = chooseParent(nearbyVertices, nearestVertex, newConfig, pathCollides, incDistance);
    // console.log({minVertex});
    if (goalReached(newConfig, goalConfig, incDistance)) {
      console.log('goal reached');
      // console.log({newConfig, minVertex, randomConfig});
    }
    let newVertex: Vertex;
    let triesLeft = 3;
    while (true) {
      try {
        newVertex = addNode(minVertex, {id: String(nodeCount++ + Math.random()), cost: 0, config: newConfig}, graph);
        break;
      } catch (e) {
        if (triesLeft > 0) {
          triesLeft--;
        } else {
          throw e;
        }
      }
    }
    // console.log({newVertex});
    reWire(graph, nearbyVertices, minVertex, newVertex, pathCollides, incDistance);
  }

  return graph;
}
