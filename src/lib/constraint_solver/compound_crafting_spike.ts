import {IndexedData} from 'minecraft-data';
import {CraftingSource, ItemSources, itemSourcesFromMinecraftData} from './item_sources.js';

interface Item {
  id: number;
}

interface CraftingStep {
  requiredInvocationCount: number;
  fesibleInvocationCount: number;
  craftingSource: CraftingSource;
}

interface CraftingPlan {
  steps: Array<CraftingStep>;
}


interface InventoryQuantity {
  item: Item;
  quantity: number;
}

type Inventory = Map<number, InventoryQuantity>;

const applyCraftingStepToInventory = (craftingStep: CraftingStep, inventory: Inventory, mcData: IndexedData): Inventory => {
  const inventoryClone = new Map();
  inventory.forEach((inventoryQuantity: InventoryQuantity, itemId: number) => {
    inventoryClone.set(itemId, {
      item: inventoryQuantity.item,
      quantity: inventoryQuantity.quantity,
    });
  });
  craftingStep.craftingSource.ingredients.forEach((ingredientQuantity, ingredientId) => {
    const inventoryQuantity = inventoryClone.get(ingredientId);
    inventoryQuantity.quantity -= ingredientQuantity * craftingStep.fesibleInvocationCount;
  });
  const itemResult = craftingStep.craftingSource.result;
  const resultCount = itemResult.count * craftingStep.fesibleInvocationCount;
  if (inventoryClone.has(itemResult.itemId)) {
    const inventoryQuantity = inventoryClone.get(itemResult.itemId);
    inventoryQuantity.quantity += resultCount;
  } else {
    const item = mcData.items[itemResult.itemId];
    inventoryClone.set(itemResult.itemId, {
      item,
      quantity: resultCount,
    });
  }
  return inventoryClone;
}

const craftingSourceSatisfiedCount = (craftingSource: CraftingSource, inventory: Inventory): number => {
  const quantity = [...craftingSource.ingredients.entries()].reduce((craftCount: number, [ingredientItemId, ingredientQuantity]) => {
    const itemCount = inventory.get(ingredientItemId)?.quantity || 0;
    const invocationCount = Math.floor(itemCount / ingredientQuantity);
    return Math.min(invocationCount, craftCount);
  }, Infinity);
  return isFinite(quantity) ? quantity : 0;
};

const craftingStepForSource = (craftingSource: CraftingSource, minQuantity: number, inventory: Inventory): CraftingStep => {
  const requiredInvocationCount = Math.ceil(minQuantity / craftingSource.result.count);
  const fesibleInvocationCount = craftingSourceSatisfiedCount(craftingSource, inventory);
  return {requiredInvocationCount, fesibleInvocationCount, craftingSource};
}

const findCompoundCraftingPlanForTest = (itemId: number, minQuantity: number, inventory: Inventory, craftingSources, depth: number) => {
  const satisfiedPlans: CraftingPlan[] = [];
  const unsatisfiedPartials: CraftingPlan[] = [];
  if (depth > 3) {
    return {satisfiedPlans, unsatisfiedPartials};
  }
  craftingSources.forEach((craftingSource: CraftingSource) => {
    if (craftingSource.result.itemId !== itemId) return;
    const partial = craftingStepForSource(craftingSource, minQuantity, inventory);
    partial.requiredInvocationCount <= partial.fesibleInvocationCount ? satisfiedPlans.push({steps: [partial]}) : unsatisfiedPartials.push({steps: [partial]});
  });

  while (unsatisfiedPartials.length > 0) {
    const partial = unsatisfiedPartials.pop();
    // TODO: Generalize this. For now assume last step is root cause.
    const unsatisfiedStep = partial.steps[partial.steps.length - 1];
    console.log({unsatisfiedPartial: partial});
    // All demands must be met for the node to be repaired.
    const subPlansByIngredient = new Map<number, {satisfiedPlans: CraftingPlan[], unsatisfiedPartials: CraftingPlan[]}>();
    let ingredientsSatisfied = true;
    unsatisfiedStep.craftingSource.ingredients.forEach((requiredQuantity, ingredientId) => {
      // TODO: handle partial crafting results
      const ingredientRequiredCount = unsatisfiedStep.requiredInvocationCount * requiredQuantity
      const ingredientInInventoryCount = inventory.get(ingredientId)?.quantity || 0;
      // If we have more than the required count, set the demand to 0
      const craftingDemand = Math.max(0, ingredientRequiredCount - ingredientInInventoryCount);
      if (craftingDemand === 0) return;
      console.log({craftingDemand, ingredientId, requiredQuantity});
      const subPlans = findCompoundCraftingPlanForTest(ingredientId, craftingDemand, inventory, craftingSources, depth + 1);
      subPlansByIngredient.set(ingredientId, subPlans);
      console.log({subPlans});
      if (subPlans.satisfiedPlans.length === 0) {
        ingredientsSatisfied = false;
      }
    });
    if (ingredientsSatisfied) {
      // TODO: handle the fact that these don't need to occur in a specific order.
      // Add in the subPlans into the partial for each ingredient.
      subPlansByIngredient.forEach((subPlans, ingredientId) => {
        console.log({addingSubplan: ingredientId});
        // For now just take the first satisfied plan.
        // TODO: handle the alternatives
        const firstPlan = subPlans.satisfiedPlans[0];
        partial.steps.push(...firstPlan.steps);
      });
      unsatisfiedStep.fesibleInvocationCount = unsatisfiedStep.requiredInvocationCount;
      satisfiedPlans.push(partial);
    }
  }
  return {satisfiedPlans, unsatisfiedPartials};
}

export const findCompoundCraftingPlanFor = (item: Item, minQuantity: number, inventory: Inventory, mcData: IndexedData, constructItemSources) => {
  const itemSources = constructItemSources.fullyExpandCollectionSources(item);
  const craftingSources = [...itemSources.values()].reduce((acm, sources) => {acm.push(...sources.crafting); return acm}, []);
  return findCompoundCraftingPlanForTest(item.id, minQuantity, inventory, craftingSources, 0);
}
