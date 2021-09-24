import {IndexedData} from 'minecraft-data';
import {ItemSources, CraftingSource} from './item_sources.js';

// Graph has nodes for items, blocks, and processes.
// Processes transform items and blocks into other items and blocks.

class Agent {
  constructor() {
  }

  // TODO: handle metadata for enchantments
  quantityInInventory(itemId): number {
    return 0;
  }

  // TODO: change the api to allow for optimiazation not just fesibility
  quantityOfBlockReachable(blockId): number {
    return 0;
  }

  quantityOfMobReachable(mobName): number {
    return 0;
  }

  // TODO: handle fuel usage for smelting.
}

export class CraftingProcess {
  constructor(craftingSource: CraftingSource) {
  }

  craftingTableRequired() {
  }

  ingredientDependencies() {
  }

  selfTimeSeconds() {
  }

  result() {
  }

  dependenciesSatisfied() {
  }

  execute() {
  }
}

export class BlockBreakProcess {
  constructor() {
  }

  selfTimeSeconds() {
  }

  result() {
  }

  dependenciesSatisfied() {
  }

  execute() {
  }
}

export class BlockPlaceProcess {
  constructor() {
  }

  selfTimeSeconds() {
  }

  result() {
  }

  dependenciesSatisfied() {
  }

  execute() {
  }
}

export class SmeltingProcess {
  constructor() {
  }

  selfTimeSeconds() {
  }

  result() {
  }

  dependenciesSatisfied() {
  }

  execute() {
  }
}

export class MobDropProcess {
  constructor() {
  }

  selfTimeSeconds() {
  }

  result() {
  }

  dependenciesSatisfied() {
  }

  execute() {
  }
}

export class PiglinBarterProcess {
  constructor() {
  }

  selfTimeSeconds() {
  }

  result() {
  }

  dependenciesSatisfied() {
  }

  execute() {
  }
}

interface GraphItem {
  id: number;
}

interface GraphBlock {
  id: number;
}

export interface ProcessGraphNode {
  readonly id: number;
  readonly label: string;
  readonly data: GraphItem | GraphBlock | CraftingProcess | SmeltingProcess | BlockBreakProcess | BlockPlaceProcess | MobDropProcess | PiglinBarterProcess;
}

export interface ProcessGraphEdge {
  readonly label: string;
  readonly source: number;
  readonly target: number;
}

// TODO: make the naming of itemSources more consistent.
export const processGraph = (mcData: IndexedData, itemSources: Map<number, ItemSources>) => {
  const nodeIdsCreated = new Set<number>();
  const edgeIdsCreated = new Set<number>();
  const graph = {
    nodes: new Array<ProcessGraphNode>(),
    edges: new Array<ProcessGraphEdge>(),
  };

  const itemNameFromId = (itemId: number): string => {
    return mcData.items[itemId].displayName;
  };
  const blockNameFromId = (blockId: number): string => {
    return mcData.blocks[blockId].displayName;
  };

  const blockNodeId = (blockId: number): number => {
    return blockId + 2000;
  }
  const craftingNodeId = (itemId: number): number => {
    return itemId + 4000;
  }
  const blockBreakNodeId = (blockId: number): number => {
    return blockId + 6000;
  }
  const blockPlaceNodeId = (blockId: number): number => {
    return blockId + 8000;
  }
  const smeltingNodeId = (itemId: number): number => {
    return itemId + 10000;
  }
  const mobDropNodeId = (mobInternalId: number): number => {
    return mobInternalId + 12000;
  }
  const piglinBarterNodeId = (itemId: number): number => {
    return itemId + 14000;
  }

  for (const [targetItemId, sources] of itemSources.entries()) {
    if (nodeIdsCreated.has(targetItemId)) {
      continue;
    } else {
      nodeIdsCreated.add(targetItemId);
    }
    graph.nodes.push({id: targetItemId, label: 'item: ' + itemNameFromId(targetItemId), data: {id: targetItemId} as GraphItem});

    for (const craftingSource of sources.crafting) {
      if (!nodeIdsCreated.has(craftingNodeId(targetItemId))) {
        nodeIdsCreated.add(craftingNodeId(targetItemId));
        graph.nodes.push({
          id: craftingNodeId(targetItemId),
          label: 'craft: ' + itemNameFromId(targetItemId),
          data: new CraftingProcess(craftingSource),
        });
      }
      graph.edges.push({source: craftingNodeId(targetItemId), target: targetItemId, label: 'craft'});
      for (const ingredientId of craftingSource.ingredients.keys()) {
        graph.edges.push({source: ingredientId, target: craftingNodeId(targetItemId), label: 'ingredient'});
      }
      if (craftingSource.requiresCraftingTable) {
        // Should be able to delete this as breakSource creates the block node
        if (!nodeIdsCreated.has(blockNodeId(craftingSource.craftingTableBlockId))) {
          nodeIdsCreated.add(blockNodeId(craftingSource.craftingTableBlockId));
          graph.nodes.push({
            id: blockNodeId(craftingSource.craftingTableBlockId),
            label: 'block: ' + blockNameFromId(craftingSource.craftingTableBlockId),
            data: {id: craftingSource.craftingTableBlockId} as GraphBlock,
          });
          graph.nodes.push({
            id: blockPlaceNodeId(craftingSource.craftingTableBlockId),
            label: 'place: ' + blockNameFromId(craftingSource.craftingTableBlockId),
            data: new BlockPlaceProcess(),
          });
          graph.edges.push({source: craftingSource.craftingTableItemId, target: blockPlaceNodeId(craftingSource.craftingTableBlockId), label: 'requires'});
          graph.edges.push({source: blockPlaceNodeId(craftingSource.craftingTableBlockId), target: blockNodeId(craftingSource.craftingTableBlockId), label: 'place'});
        }
        graph.edges.push({source: blockNodeId(craftingSource.craftingTableBlockId), target: craftingNodeId(targetItemId), label: 'interact'});
      }
    }
  }


  return graph;
}
