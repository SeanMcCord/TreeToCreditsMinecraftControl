import pathfinder from 'mineflayer-pathfinder';
import Vec3 from 'vec3';
const {Movements, goals} = pathfinder

export function itemCountOfBlocksInInventory(bot, mcData, blockIds) {
  const allBlockDropIds = blockIds.flatMap((block) => block.drops)
  const uniqueBlockDropIds = [...new Set(allBlockDropIds)]
  const itemIds = uniqueBlockDropIds.map((blockId) => mcData.items[blockId])
  return bot.inventory.items()
    .filter(item => itemIds.includes(item.type))
    .reduce((count, item) => count + item.count, 0)
}

export async function collectNblocks(bot, quantity, blocks, range) {
  console.log({colleting: {quantity, blocks}})
  await new Promise(async (resolve, reject) => {
    if (quantity == 0) {
      resolve()
      return
    }
    // Find nearby blocks
    const candidateBlocks = bot.findBlocks({
      matching: (block) => blocks.includes(block.type),
      maxDistance: range,
      count: 64
    })
    // TODO: make this consider the quantity of blocks needed to mine during path formation
    const blockTargetPosition = await getLowestCostPosition(bot, candidateBlocks)
    const blockTarget = bot.blockAt(blockTargetPosition)

    if (blockTarget) {
      // If we found one, collect it.
      bot.collectBlock.collect(blockTarget, async (err) => {
        if (err) {
          // Handle errors, if any
          console.log({failedToCollectBlock: blockTarget, err})
          reject(err)
          return
        } else {
          await collectNblocks(bot, quantity - 1, blocks, range) // Collect another block
          resolve()
          return
        }
      })
    } else {
      reject(new Error('block not found'))
      console.log({blockNotFound: blockTargetPosition})
    }
  })
}

async function getLowestCostPosition(bot, blocks) {
  const goal = new goals.GoalCompositeAny()
  blocks.map((block) => {
    goal.push(new goals.GoalGetToBlock(block.x, block.y, block.z))
  })
  // console.log('calculating paths start')
  const result = bot.pathfinder.getPathTo(bot.pathfinder.movements, goal, 15000)
  // console.log('calculating paths done')
  if (result.path.length == 0) {
    return blocks[0]
  }
  // console.log({ result })
  // console.log({ path: result.path })
  const goalFinalMove = result.path[result.path.length - 1]
  // find the block closest to the end location
  const distances = blocks.map((block) => goalFinalMove.distanceTo(block))
  let lowest = 0;
  for (let i = 1; i < distances.length; i++) {
    if (distances[i] < distances[lowest]) lowest = i;
  }
  // console.log({closestBlock: blocks[lowest]})
  return blocks[lowest]
}

export async function placeBlockInReachableLocation(bot, mcData, itemId) {
  // confirm bot has item in inventory
  // hack, just give it a second to show up... There is an issue with the slot mineflayer expects crafted items to be placed in.
  // it differs from what the server does
  let item

  // TODO: clean this up
  item = bot.inventory.items().filter(item => item.type === itemId)[0]
  if (!item) {
    console.log({itemNotFoundInInventory: itemId})
    console.log('waiting to retry')
    await new Promise(r => setTimeout(r, 1000));
    item = bot.inventory.items().filter(item => item.type === itemId)[0]
    if (!item) {
      console.log({itemNotFoundInInventory: itemId})
      throw new Error(`Item with id ${itemId} not in inventory`)
    }
  }

  // TODO rethink this
  const directions = [
    {x: 0, y: 0, z: -1}, // north
    {x: 0, y: 0, z: 1}, // south
    {x: -1, y: 0, z: 0}, // west
    {x: 1, y: 0, z: 0}, // east
    {x: 0, y: 1, z: 0}, // up
    // { x: 0, y: -1, z: 0 } // down
  ]

  // Returns the vector from the block position to the air block next to it
  const getFreeFacingVector = (position) => {
    return directions.find((dir) => {
      const block = bot.blockAt(position.offset(dir.x, dir.y, dir.z))
      if (block != null && block.type == mcData.blocksByName.air.id) {
        // make sure we are not in that block
        // TODO: make this check better
        if (block.position.distanceTo(bot.entity.position) < 3) {
          return false
        }
        return true
      }
      return false
    })
  }
  // find a location
  console.log('finding blocks to place')
  const blockTarget = bot.findBlock({
    // TODO: This doesn't have to be air. Find out how to query for all placeable blocks
    matching: (id) => id != mcData.blocksByName.air.id,
    useExtraInfo: (extraInfo) => {
      // confirm the block is reachable and has a placeable face
      // check if the block has an exposed face
      if (extraInfo.boundingBox == 'empty') {
        return false
      }
      const facingVector = getFreeFacingVector(extraInfo.position)
      // console.log({ facingVector })
      if (facingVector != null) {
        return true
      } else {
        return false
      }
    },
    maxDistance: 64
  })

  if (!blockTarget) {
    // Default starting location is the bot position
    console.log({noViableLocationsNear: bot.entity.position})
    throw new Error('failed to find location for block')
  }
  // move towards it

  const facing = getFreeFacingVector(blockTarget.position)
  const facingVec = new Vec3(facing.x, facing.y, facing.z)
  const blockLocation = blockTarget.position.offset(facing.x, facing.y, facing.z)
  const playerFacingVec = facingVec.scaled(-1)
  console.log({solidBlockPosition: blockTarget.position, freeFaceVector: facingVec, placeLocation: blockLocation, playerFacingVec})

  bot.pathfinder.setMovements(getRespectfulMoveset(bot, mcData))
  await bot.pathfinder.goto(new goals.GoalPlaceBlock(blockLocation, bot.world, {faces: [playerFacingVec]}))

  // place it
  bot.setControlState('sneak', true)
  console.log('look at')
  await bot.lookAt(blockTarget.position.offset(facing.x * 0.5, facing.y * 0.5, facing.z * 0.5), true)
  await bot.equip(item, 'hand')
  console.log('place block')
  await bot.placeBlock(blockTarget, facingVec)
  console.log('set control state')
  bot.setControlState('sneak', false)

  // return location
  const block = bot.blockAt(blockLocation)
  const controlState = bot.getControlState('sneak')
  console.log({blockLocation, block, controlState})
  return block
}

// craftingTable being null crafts in the inventory
export async function craftItems(bot, itemIds, quantity, craftingTable) {
  console.log({botInventory: bot.inventory.items()})
  // TODO: fix min quantity
  const getRecipes = () => {
    return itemIds.flatMap((itemId) => {
      return bot.recipesFor(itemId, null, 1, craftingTable);
    })
  }
  let recipe = getRecipes()[0]
  if (!recipe) {
    console.log({itemsNotCraftableWithInventory: itemIds})
    console.log('waiting to retry')
    await new Promise(r => setTimeout(r, 1000));
    recipe = getRecipes()[0]
    if (!recipe) {
      console.log({noRecipeFound: itemIds, quantity, craftingTable})
      throw new Error(`Failed to construct items with ids ${itemIds}`)
    }
  }
  console.log({recipe, ingredients: recipe.ingredients, delta: recipe.delta, quantity, craftingTable})
  await bot.craft(recipe, quantity, craftingTable, (err) => {
    if (err != null) {
      console.log({err})
    }
  })
}

export async function beginSmeltItems(bot, mcData, itemId, quantity, furnaceBlock) {
  console.log('open furnace')
  const furnace = await bot.openFurnace(furnaceBlock)
  const tree_names = ['oak', 'dark_oak', 'birch', 'spruce', 'jungle', 'acacia'];
  const plank_item_ids = tree_names.map((tree_name) => `${tree_name}_planks`)
    .map((plank_name) => mcData.itemsByName[plank_name].id)
  const smeltItem = bot.inventory.items().find(item => plank_item_ids.includes(item.type))
  if (smeltItem == null) {
    throw new Error('No items to smelt with');
  }
  // TODO: allow other fuels and quantities of fuel
  // a plank can smelt 1.5 items.
  const fuelNeeded = Math.ceil(quantity / 1.5)
  console.log({putNFuel: fuelNeeded, fuel: smeltItem})
  await furnace.putFuel(smeltItem.type, null, fuelNeeded)
  console.log({putItemInFurnace: itemId, quantity})
  await furnace.putInput(itemId, null, quantity)
  console.log('close furnace')
  furnace.close()
  // TODO: do this based on furnace progress
  const bakeTime = quantity * 10000 + 1000
  return bakeTime
}

export async function endSmeltItems(bot, furnaceBlock) {
  console.log('open furnace')
  const furnace = await bot.openFurnace(furnaceBlock)
  console.log({progress: furnace.progress})
  console.log('take output')
  await furnace.takeOutput()
  try {
    console.log('take input')
    await furnace.takeInput()
  } catch (error) {
    if (error.name != 'AssertionError') {
      throw error
    }
  }
  try {
    console.log('take fuel')
    await furnace.takeFuel()
  } catch (error) {
    if (error.name != 'AssertionError') {
      throw error
    }
  }
  console.log('close furnace')
  furnace.close()
}

export async function slurpNearestFluidIntoBucket(bot, mcData, blockId, range) {
  // Find a nearby fluid
  const isSourceBlock = (stateId) => {
    const block = mcData.blocks[blockId];
    if (block.name === 'lava') {
      return stateId === block.minStateId
    } else {
      // water uses maxStateId for source blocks.
      return stateId === block.maxStateId
    }
  }

  const directions = {
    up: new Vec3(0, 1, 0),
    down: new Vec3(0, -1, 0),
    north: new Vec3(0, 0, -1),
    south: new Vec3(0, 0, 1),
    east: new Vec3(1, 0, 0),
    west: new Vec3(-1, 0, 0),
  }
  // Returns the vector from the block position to the air block next to it
  const isTopSurfaceExposed = (position) => {
    const blockOneAbove = bot.blockAt(position.offset(0, 1, 0))
    const blockTwoAbove = bot.blockAt(position.offset(0, 2, 0))
    const isAirBLock = (block) => block != null && (block.type === mcData.blocksByName.air.id || block.type === mcData.blocksByName.cave_air.id)
    return isAirBLock(blockOneAbove) && isAirBLock(blockTwoAbove)
  }

  // HACK: For now this only handles the case of the fluid having an exposed top surface.
  // TODO: Handle the general case of fluid collection. This includes blocks that may be completely encolsed.
  const candidateBlocks = bot.findBlocks({
    matching: blockId,
    useExtraInfo: (extraInfo) => isSourceBlock(extraInfo.stateId) && isTopSurfaceExposed(extraInfo.position),
    maxDistance: range,
    count: 64
  })
  const blockTargetPosition = await getLowestCostPosition(bot, candidateBlocks)
  await slurpFluidIntoBucket(bot, mcData, blockTargetPosition)
}

async function slurpFluidIntoBucket(bot, mcData, fluidPosition) {
  // make sure we have an empty bucket in inventory
  const bucketItemId = mcData.itemsByName.bucket.id
  const bucket = bot.inventory.items().filter(item => item.type === bucketItemId)[0]
  if (!bucket) {
    console.log({inventory: bot.inventory})
    console.log({itemNotFoundInInventory: 'bucket'})
    throw new Error('Bucket item not in inventory')
  }
  // goto target
  // console.log({fluidPosition})
  bot.pathfinder.setMovements(getRespectfulMoveset(bot, mcData))
  // get the list of exposed faces
  // HACK: related to the above hack to only attempt the top surface of the block
  // const surfaceDirections = [new Vec3(0, 1, 0)]
  // await bot.pathfinder.goto(new goals.GoalPlaceBlock(fluidPosition, bot.world, {faces: surfaceDirections, facing: 'down', facing3D: true}))
  const nearPosition = fluidPosition.offset(0.5, 2, 0.5)
  //  console.log({nearPosition})
  const goal = new goals.GoalNear(nearPosition.x, nearPosition.y, nearPosition.z, 2)
  await bot.pathfinder.asyncGoto(goal)

  // HACK: break any block that is in our way until we can see the goal block

  // console.log({equipBucket: bucket})
  await bot.equip(bucket, 'hand')
  // look at target
  // console.log({lookAt: fluidPosition})
  // HACK: make it look at the top surface of the fluid.
  const lookLocation = fluidPosition.offset(0.5, 1, 0.5)
  // console.log({lookLocation})
  await bot.lookAt(lookLocation, true)
  await bot.waitForTicks(5)
  const block = bot.blockAtCursor(4)
  // console.log({lookingAtBlock: block})
  // slurp
  // console.log('activate Bucket')
  bot.activateItem()
  // not sure if we need to wait on this
  bot.deactivateItem()
  // console.log('deactivate Bucket')
}

export function getRespectfulMoveset(bot, mcData) {
  const moves = new Movements(bot, mcData)
  moves.blocksCantBreak.add(mcData.blocksByName.furnace.id)
  moves.blocksCantBreak.add(mcData.blocksByName.crafting_table.id)
  return moves
}