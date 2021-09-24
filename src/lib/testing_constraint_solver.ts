import minecraftData, {IndexedData} from 'minecraft-data';
import repl from 'repl';
import {ItemSources, itemSourcesFromMinecraftData} from './constraint_solver/item_sources.js';
import {findCompoundCraftingPlanFor} from './constraint_solver/compound_crafting_spike.js';

const mcData = minecraftData('1.16.4');
const constructItemSources = itemSourcesFromMinecraftData(mcData);

const toGraphViz = (itemSources: Map<number, ItemSources>) => {
  const nodeIdsCreated = new Set<number>();
  const result = {
    nodes: [],
    edges: [],
  }

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
  const smeltingNodeId = (itemId: number): number => {
    return itemId + 8000;
  }
  const mobDropNodeId = (mobInternalId: number): number => {
    return mobInternalId + 10000;
  }
  const piglinBarterNodeId = (itemId: number): number => {
    return itemId + 12000;
  }


  // Node types
  // 1: items
  // 2: blocks
  // 3: crafting
  // 4: blockBreak
  // 5: smelting
  for (const [targetItemId, sources] of itemSources.entries()) {
    if (nodeIdsCreated.has(targetItemId)) {
      continue;
    } else {
      nodeIdsCreated.add(targetItemId);
    }
    result.nodes.push({id: targetItemId, label: 'item: ' + itemNameFromId(targetItemId)});

    for (const craftingSource of sources.crafting) {
      if (!nodeIdsCreated.has(craftingNodeId(targetItemId))) {
        nodeIdsCreated.add(craftingNodeId(targetItemId));
        result.nodes.push({id: craftingNodeId(targetItemId), label: 'craft: ' + itemNameFromId(targetItemId)});
      }
      result.edges.push({from: craftingNodeId(targetItemId), to: targetItemId, label: 'craft'});
      for (const ingredientId of craftingSource.ingredients.keys()) {
        result.edges.push({from: ingredientId, to: craftingNodeId(targetItemId), label: 'ingredient'});
      }
      if (craftingSource.requiresCraftingTable) {
        // Should be able to delete this as breakSource creates the block node
        if (!nodeIdsCreated.has(blockNodeId(craftingSource.craftingTableBlockId))) {
          nodeIdsCreated.add(blockNodeId(craftingSource.craftingTableBlockId));
          result.nodes.push({id: blockNodeId(craftingSource.craftingTableBlockId), label: 'block: ' + blockNameFromId(craftingSource.craftingTableBlockId)});
        }
        result.edges.push({from: craftingSource.craftingTableItemId, to: blockNodeId(craftingSource.craftingTableBlockId), label: 'place'});
        result.edges.push({from: blockNodeId(craftingSource.craftingTableBlockId), to: craftingNodeId(targetItemId), label: 'requires'});
      }
    }

    for (const breakSource of sources.blockBreak) {
      if (!nodeIdsCreated.has(blockNodeId(breakSource.blockId))) {
        nodeIdsCreated.add(blockNodeId(breakSource.blockId));
        result.nodes.push({id: blockNodeId(breakSource.blockId), label: 'block: ' + blockNameFromId(breakSource.blockId)});
      }
      result.edges.push({from: blockNodeId(breakSource.blockId), to: blockBreakNodeId(breakSource.blockId), label: 'exists'});

      if (!nodeIdsCreated.has(blockBreakNodeId(breakSource.blockId))) {
        nodeIdsCreated.add(blockBreakNodeId(breakSource.blockId));
        result.nodes.push({id: blockBreakNodeId(breakSource.blockId), label: 'break: ' + blockNameFromId(breakSource.blockId)});
      }
      // Id offset for blockIds
      result.edges.push({from: blockBreakNodeId(breakSource.blockId), to: targetItemId, label: 'blockDrop'});
      // Tools
      for (const toolId of breakSource.toolIds) {
        result.edges.push({from: toolId, to: blockBreakNodeId(breakSource.blockId), label: 'tool'});
      }
      // TODO: handle other drops from item break.
      // TODO: handle silk touch required or forbidden.
    }

    for (const smeltSource of sources.smelting) {
      if (!nodeIdsCreated.has(smeltingNodeId(targetItemId))) {
        nodeIdsCreated.add(smeltingNodeId(targetItemId));
        result.nodes.push({id: smeltingNodeId(targetItemId), label: 'smelt: ' + itemNameFromId(targetItemId)});
      }
      result.edges.push({from: smeltSource.inputItemId, to: smeltingNodeId(targetItemId), label: 'smelt input'});
      result.edges.push({from: smeltingNodeId(targetItemId), to: targetItemId, label: 'smelt output'});

      // Should be able to delete this as breakSource creates the block node
      if (!nodeIdsCreated.has(blockNodeId(smeltSource.smelterBlockId))) {
        nodeIdsCreated.add(blockNodeId(smeltSource.smelterBlockId));
        result.nodes.push({id: blockNodeId(smeltSource.smelterBlockId), label: 'block: ' + blockNameFromId(smeltSource.smelterBlockId)});
      }
      result.edges.push({from: smeltSource.smelterItemId, to: blockNodeId(smeltSource.smelterBlockId), label: 'place'});
      result.edges.push({from: blockNodeId(smeltSource.smelterBlockId), to: smeltingNodeId(targetItemId), label: 'requires'});
    }

    for (const mobDropSource of sources.mobDrop) {
      if (!nodeIdsCreated.has(mobDropNodeId(mobDropSource.mobInternalId))) {
        nodeIdsCreated.add(mobDropNodeId(mobDropSource.mobInternalId));
        result.nodes.push({id: mobDropNodeId(mobDropSource.mobInternalId), label: 'mobDrop: ' + mobDropSource.mobName});
      }
      result.edges.push({from: mobDropNodeId(mobDropSource.mobInternalId), to: targetItemId, label: 'drops'});
    }

    if (sources.piglinBarter != null) {
      if (!nodeIdsCreated.has(piglinBarterNodeId(targetItemId))) {
        nodeIdsCreated.add(piglinBarterNodeId(targetItemId));
        result.nodes.push({id: piglinBarterNodeId(targetItemId), label: 'piglinBarter: ' + itemNameFromId(targetItemId)});
      }
      result.edges.push({from: piglinBarterNodeId(targetItemId), to: targetItemId, label: 'barter'});
      result.edges.push({from: sources.piglinBarter.barterForItemId, to: piglinBarterNodeId(targetItemId), label: 'barterFor'});
    }
  }

  console.log(JSON.stringify(result));
}

const context = repl.start('> ').context;
context.mcData = mcData;
context.constructItemSources = constructItemSources;
context.toGraphViz = toGraphViz;
context.findCompoundCraftingPlanFor = findCompoundCraftingPlanFor;
