import {IndexedData, Item} from 'minecraft-data';

export interface FungibleItemsIndex {
  wool: Array<Item>;
  log: Array<Item>;
  plank: Array<Item>;
  bed: Array<Item>;
  stone: Array<Item>;
}

// By default we should assume that items in recipes are exact, but some allow for subsitution.
// For example, crafting a crafting table can use many types of plank.
// When crafting a bed the planks are fungible, but the wool must all be the same color.
export const constructFungibleItems = (mcData: IndexedData): FungibleItemsIndex => {
  // TODO: consider the group names to ensure their scope is clear.
  return {
    wool: [],
    log: [],
    plank: [],
    bed: [],
    stone: [],
  }
}
