import {IndexedData} from 'minecraft-data';

// Processes to get an item.
// In chest nearby
// Break block drop
// Mob drop
// Villager trade
// Piglen trade
// Smelt
// Craft
// Fill bucket

// There are a few different questions that can be asked.
// 1: Is there any way to get this item in the current environment?
// 2: What is the fastest way to get this item in the current environment?
// 3: What is the most reliable way to get this item in the current environment?

// TODO: make the distinction between having the item in inventory and having a block placed
// such as a crafting table.
// TODO: handle breaking speed of different tools.
// TODO: ensure these plans can be understood by a human.

interface Item {
  id: number;
}

// While it is redundent to have the crafting table item and block ids in every crafting source.
// The cost is pretty low and the positive is that it removes implicit knowledge from consumers.
export interface CraftingSource {
  requiresCraftingTable: boolean;
  craftingTableItemId: number;
  craftingTableBlockId: number;
  ingredients: Map<number, number>;
  result: {count: number, itemId: number};
}

export interface BlockBreakSource {
  blockId: number;
  toolIds: Array<number>;
  enchantments: {required: Array<string>, forbidden: Array<string>};
  results: Array<{itemId: number, probability: number}>;
}

export interface SmeltingSource {
  smelterItemId: number;
  smelterBlockId: number;
  inputItemId: number;
}

export interface MobDropSource {
  mobInternalId: number;
  mobName: string;
  probability: number;
}

export interface PiglinBarterSource {
  barterForItemId: number;
  quantityMin: number;
  quantityMax: number;
  probability: number;
}

export interface ItemSources {
  crafting: Array<CraftingSource>;
  blockBreak: Array<BlockBreakSource>;
  smelting: Array<SmeltingSource>;
  mobDrop: Array<MobDropSource>;
  piglinBarter: PiglinBarterSource | undefined;
}

// These values are pretty obvious to someone that played minecraft, but I don't like magic numbers in the functions.
const INVENTORY_CRAFTING_MAX_SLOT_COUNT = 4;
const INVENTORY_CRAFTING_MAX_COLUMN_ROW_LENGTH = 2;

export const itemSourcesFromMinecraftData = (mcData: IndexedData) => {
  const mobDrops = {
    [mcData.itemsByName.ender_pearl.id]: [
      {
        mobInternalId: mcData.entitiesByName.enderman.id,
        mobName: mcData.entitiesByName.enderman.name,
        // https://minecraft.fandom.com/wiki/Ender_Pearl
        probability: 1.0,
        quantityMin: 0,
        quantityMax: 1,
      }
    ],
    [mcData.itemsByName.blaze_rod.id]: [
      {
        mobInternalId: mcData.entitiesByName.blaze.id,
        mobName: mcData.entitiesByName.blaze.name,
        probability: 1.0,
        quantityMin: 0,
        quantityMax: 1,
      },
    ],
    [mcData.itemsByName.iron_ingot.id]: [
      {
        mobInternalId: mcData.entitiesByName.iron_golem.id,
        mobName: mcData.entitiesByName.iron_golem.name,
        probability: 1.0,
        quantityMin: 3,
        quantityMax: 5,
      },
      {
        mobInternalId: mcData.entitiesByName.zombie.id,
        mobName: mcData.entitiesByName.zombie.name,
        probability: 0.025,
        quantityMin: 0,
        quantityMax: 1,
      },
      {
        mobInternalId: mcData.entitiesByName.zombie_villager.id,
        mobName: mcData.entitiesByName.zombie_villager.name,
        probability: 0.025,
        quantityMin: 0,
        quantityMax: 1,
      },
      {
        mobInternalId: mcData.entitiesByName.husk.id,
        mobName: mcData.entitiesByName.husk.name,
        probability: 0.025,
        quantityMin: 0,
        quantityMax: 1,
      },
    ],
    [mcData.itemsByName.bow.id]: [
      {
        mobInternalId: mcData.entitiesByName.skeleton.id,
        mobName: mcData.entitiesByName.skeleton.name,
        // https://minecraft.fandom.com/wiki/Skeleton
        probability: 0.085,
        quantityMin: 1,
        quantityMax: 1,
      },
    ],
    [mcData.itemsByName.arrow.id]: [
      {
        mobInternalId: mcData.entitiesByName.skeleton.id,
        mobName: mcData.entitiesByName.skeleton.name,
        // https://minecraft.fandom.com/wiki/Drops
        probability: 1.0,
        quantityMin: 0,
        quantityMax: 2,
      },
    ],
    [mcData.itemsByName.string.id]: [
      {
        mobInternalId: mcData.entitiesByName.spider.id,
        mobName: mcData.entitiesByName.spider.name,
        // https://minecraft.fandom.com/wiki/Drops
        probability: 1.0,
        quantityMin: 0,
        quantityMax: 2,
      },
    ],
    [mcData.itemsByName.beef.id]: [
      {
        mobInternalId: mcData.entitiesByName.cow.id,
        mobName: mcData.entitiesByName.cow.name,
        // https://minecraft.fandom.com/wiki/Drops
        probability: 1.0,
        quantityMin: 1,
        quantityMax: 3,
      },
    ],
    [mcData.itemsByName.chicken.id]: [
      {
        mobInternalId: mcData.entitiesByName.chicken.id,
        mobName: mcData.entitiesByName.chicken.name,
        // https://minecraft.fandom.com/wiki/Drops
        probability: 1.0,
        quantityMin: 1,
        quantityMax: 1,
      },
    ],
    [mcData.itemsByName.feather.id]: [
      {
        mobInternalId: mcData.entitiesByName.chicken.id,
        mobName: mcData.entitiesByName.chicken.name,
        // https://minecraft.fandom.com/wiki/Drops
        probability: 1.0,
        quantityMin: 0,
        quantityMax: 2,
      },
    ],
    [mcData.itemsByName.mutton.id]: [
      {
        mobInternalId: mcData.entitiesByName.sheep.id,
        mobName: mcData.entitiesByName.sheep.name,
        // https://minecraft.fandom.com/wiki/Drops
        probability: 1.0,
        quantityMin: 1,
        quantityMax: 2,
      },
    ],
    // TODO: handle fungible wool colors
    [mcData.itemsByName.white_wool.id]: [
      {
        // TODO: if not sheared. Maybe add condition for sheared.
        mobInternalId: mcData.entitiesByName.sheep.id,
        mobName: mcData.entitiesByName.sheep.name,
        // https://minecraft.fandom.com/wiki/Drops
        probability: 1.0,
        quantityMin: 1,
        quantityMax: 1,
      },
    ],
    [mcData.itemsByName.porkchop.id]: [
      {
        mobInternalId: mcData.entitiesByName.pig.id,
        mobName: mcData.entitiesByName.pig.name,
        // https://minecraft.fandom.com/wiki/Drops
        probability: 1.0,
        quantityMin: 1,
        quantityMax: 1,
      },
      {
        mobInternalId: mcData.entitiesByName.hoglin.id,
        mobName: mcData.entitiesByName.hoglin.name,
        // https://minecraft.fandom.com/wiki/Drops
        probability: 1.0,
        quantityMin: 2,
        quantityMax: 4,
      },
    ],
  };

  const piglinBarterDrops = {
    [mcData.itemsByName.ender_pearl.id]: {
      probability: 10 / 459,
      quantityMin: 2,
      quantityMax: 4,
    },
    [mcData.itemsByName.string.id]: {
      probability: 20 / 459,
      quantityMin: 3,
      quantityMax: 9,
    },
    [mcData.itemsByName.obsidian.id]: {
      probability: 40 / 459,
      quantityMin: 1,
      quantityMax: 1,
    },
    [mcData.itemsByName.crying_obsidian.id]: {
      probability: 40 / 459,
      quantityMin: 1,
      quantityMax: 3,
    },
  }

  // TODO: handle fortune enchantment
  // prismarine-data does not list the probability of an item drop*
  // Assumes no silk touch.
  // * It has some loot tables, but I'm not sure if they are part of the supported modern api.
  const blockBreakAdditionalDrops = {
    [mcData.blocksByName.gravel.id]: {
      itemId: mcData.itemsByName.flint.id,
      probability: 0.09,
    },
  };

  // Some blocks in prismarine-data list drops that only work if the tool has silk touch.
  const silkTouchBlockInvertedDrops = {
    [mcData.blocksByName.coal_ore.id]: {
      itemId: mcData.itemsByName.coal.id,
    },
    [mcData.blocksByName.diamond_ore.id]: {
      itemId: mcData.itemsByName.diamond.id,
    },
  };


  // prismarine-data doesn't seem to have the smelt operations.
  const smeltOperations = {
    [mcData.itemsByName.iron_ingot.id]: [
      {
        input: mcData.itemsByName.iron_ore.id,
        output: mcData.itemsByName.iron_ingot.id,
      }
    ],
    [mcData.itemsByName.gold_ingot.id]: [
      {
        input: mcData.itemsByName.gold_ore.id,
        output: mcData.itemsByName.gold_ingot.id,
      }
    ],
    // TODO: Add more operations to this.
  };

  // TODO: Would be nice to return details about the makespan and inventory space needed.
  const craftingDependencies = (item: Item): Array<CraftingSource> => {
    const potentialRecipies = mcData.recipes[item.id];
    if (potentialRecipies == null) {
      return [];
    }
    return Object.values(potentialRecipies).reduce((validRecipes, recipe) => {
      if (recipe == null) return validRecipes;
      let requiresCraftingTable = false;

      // Some of these define inShape, others use ingredients
      let quantityNeededById = new Map<number, number>();
      if (recipe.inShape != null) {
        if (recipe.inShape.length > INVENTORY_CRAFTING_MAX_COLUMN_ROW_LENGTH) {
          requiresCraftingTable = true;
        }
        quantityNeededById = recipe.inShape.reduce((map, inShapeRow) => {
          if (inShapeRow.length > INVENTORY_CRAFTING_MAX_COLUMN_ROW_LENGTH) {
            requiresCraftingTable = true;
          }
          for (const ingredient of inShapeRow) {
            if (ingredient == null) continue;
            if (map.has(ingredient)) {
              map.set(ingredient, map.get(ingredient) + 1);
            } else {
              map.set(ingredient, 1);
            }
          }
          return map;
        }, quantityNeededById);
      } else if (recipe.ingredients != null) {
        if (recipe.ingredients.length > INVENTORY_CRAFTING_MAX_SLOT_COUNT) {
          requiresCraftingTable = true;
        }
        quantityNeededById = recipe.ingredients.reduce((map, ingredient) => {
          if (ingredient == null) return map;
          if (map.has(ingredient)) {
            map.set(ingredient, map.get(ingredient) + 1);
          } else {
            map.set(ingredient, 1);
          }
          return map;
        }, quantityNeededById);
      } else {
        throw new Error(`Invalid recipe format provided ${recipe}`);
      }
      const result = {
        count: recipe.result.count,
        itemId: recipe.result.id,
      };
      validRecipes.push({
        ingredients: quantityNeededById,
        result,
        requiresCraftingTable,
        craftingTableItemId: mcData.itemsByName.crafting_table.id,
        craftingTableBlockId: mcData.blocksByName.crafting_table.id,
      });

      return validRecipes;
    }, []);
  }

  // Returns the block to break with given tools and enchantments to get item.
  const breakBlockDependencies = (item: Item): Array<BlockBreakSource> => {
    return Object.entries(mcData.blocks).reduce((sources, [blockIdString, block]) => {
      const blockId = parseInt(blockIdString);
      const silkTouchDropInverted = silkTouchBlockInvertedDrops[blockId];
      const additionalDrop = blockBreakAdditionalDrops[blockId];
      if (block.drops.includes(item.id) || silkTouchDropInverted?.itemId === item.id || additionalDrop?.itemId === item.id) {
        // Assume that additionalDrop is never found for silk touch blocks.
        const probability = additionalDrop?.itemId === item.id ? additionalDrop?.probability : 1.0;
        const toolIds = block.harvestTools == null ? [] : Object.keys(block.harvestTools).map(toolId => parseInt(toolId));
        const breakOption = {
          blockId,
          // TODO: make it clear when any tool will result in drop.
          toolIds,
          enchantments: {forbidden: [], required: []},
          results: [
            {itemId: item.id, probability},
          ]
        }
        // TODO: handle adding all the drops to the results. i.e. breaking gravel results in gravel everytime and additionall flint
        // However some blocks do not always result in their drops. coal ore drops depend on silk touch.
        if (silkTouchDropInverted) {
          if (silkTouchDropInverted.itemId === item.id) {
            breakOption.enchantments.forbidden.push('silk_touch');
          } else {
            breakOption.enchantments.required.push('silk_touch');
          }
        }
        sources.push(breakOption);
      }
      return sources;
    }, []);
  }

  // Returns an array of items that when smelted return the requested item.
  const smeltDependencies = (item: Item): Array<SmeltingSource> => {
    const smeltForItem = smeltOperations[item.id];
    if (smeltForItem == null) {
      return [];
    }
    return smeltForItem.map((s) => {
      return {
        inputItemId: s.input,
        smelterItemId: mcData.itemsByName.furnace.id,
        smelterBlockId: mcData.blocksByName.furnace.id,
      };
    });
  }

  const mobDropDependencies = (item: Item): Array<MobDropSource> => {
    const mobDrop = mobDrops[item.id];
    if (mobDrop == null) {
      return [];
    }
    return mobDrop.map(drop => Object.assign({}, drop));
  }

  const piglinBarterDependencies = (item: Item): PiglinBarterSource => {
    const barter = piglinBarterDrops[item.id];
    if (barter == null) {
      return;
    }
    return Object.assign({}, barter, {barterForItemId: mcData.itemsByName.gold_ingot.id});
  }

  const potentialCollectionSources = (item: Item): ItemSources => {
    return {
      crafting: craftingDependencies(item),
      blockBreak: breakBlockDependencies(item),
      smelting: smeltDependencies(item),
      mobDrop: mobDropDependencies(item),
      piglinBarter: piglinBarterDependencies(item),
    };
  }

  const fullyExpandCollectionSources = (item: Item): Map<number, ItemSources> => {
    const unexpandedItemIds = [item.id];
    const expandedItemIds = new Map<number, ItemSources>();
    while (unexpandedItemIds.length !== 0) {
      const itemId = unexpandedItemIds.shift();
      if (expandedItemIds.has(itemId)) {
        continue;
      }
      const expandingItem = mcData.items[itemId];
      const routes = potentialCollectionSources(expandingItem);
      expandedItemIds.set(itemId, routes);
      for (const craft of routes.crafting) {
        unexpandedItemIds.push(...craft.ingredients.keys());
        unexpandedItemIds.push(craft.craftingTableItemId);
      }
      for (const breakBlock of routes.blockBreak) {
        breakBlock.toolIds.map(toolId => unexpandedItemIds.push(toolId));
        breakBlock.results.map(({itemId}) => unexpandedItemIds.push(itemId));
      }
      for (const smelt of routes.smelting) {
        unexpandedItemIds.push(smelt.inputItemId);
        unexpandedItemIds.push(smelt.smelterItemId);
      }
      if (routes.piglinBarter != null) {
        unexpandedItemIds.push(routes.piglinBarter.barterForItemId);
      }
    }
    return expandedItemIds;
  }

  return {
    craftingDependencies,
    breakBlockDependencies,
    smeltDependencies,
    mobDropDependencies,
    piglinBarterDependencies,
    potentialCollectionSources,
    fullyExpandCollectionSources,
  };
}

