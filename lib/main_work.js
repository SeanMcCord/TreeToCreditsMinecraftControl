import pathfinder from 'mineflayer-pathfinder';
import {beginSmeltItems, collectNblocks, craftItems, endSmeltItems, getRespectfulMoveset, placeBlockInReachableLocation, slurpNearestFluidIntoBucket, itemCountOfBlocksInInventory} from './high_level_operations.js';
const {goals} = pathfinder

export default async (bot, mcData) => {
  const defaultMoves = getRespectfulMoveset(bot, mcData)
  bot.pathfinder.setMovements(defaultMoves)
  bot.collectBlock.movements = defaultMoves

  const tree_names = ['oak', 'dark_oak', 'birch', 'spruce', 'jungle', 'acacia'];
  const log_block_ids = tree_names.map((tree_name) => `${tree_name}_log`)
    .map((log_name) => mcData.blocksByName[log_name].id)
  const plank_item_ids = tree_names.map((tree_name) => `${tree_name}_planks`)
    .map((plank_name) => mcData.itemsByName[plank_name].id)
  // minecraft-data doesn't handle the case of stone dropping cobblestone when not using silk touch
  const cobbleDroppingBlockIds = [mcData.blocksByName.cobblestone.id, mcData.blocksByName.stone.id]

  // make a crafting table
  console.log('collect logs')
  try {
    await collectNblocks(bot, 3, log_block_ids, 256)
  } catch (e) {
    console.log('getting some dirt then will try again')
    await collectNblocks(bot, 10, [mcData.blocksByName.dirt.id], 256)
    await collectNblocks(bot, 3, log_block_ids, 256)
  }
  console.log('craft planks')
  await craftItems(bot, plank_item_ids, 1, null)
  console.log('craft craftingtable')
  await craftItems(bot, [mcData.itemsByName.crafting_table.id], 1, null)

  // place the crafting table and use it
  let craftingTable = await placeBlockInReachableLocation(bot, mcData, mcData.itemsByName.crafting_table.id)
  // make a wood pick
  await craftItems(bot, plank_item_ids, 2, null)
  await craftItems(bot, [mcData.itemsByName.stick.id], 1, null)
  console.log('create axe start')
  await craftItems(bot, [mcData.itemsByName.wooden_axe.id], 1, craftingTable)
  console.log('create axe done')

  // get some more for fuel and tools
  let existingLogCount = itemCountOfBlocksInInventory(bot, mcData, log_block_ids);
  let logCollectCount = 3 - existingLogCount;
  if (logCollectCount > 0) await collectNblocks(bot, logCollectCount, log_block_ids, 256)

  // make a wood pick
  await craftItems(bot, plank_item_ids, 1, null)
  await craftItems(bot, [mcData.itemsByName.stick.id], 1, null)

  // Go back to the crafting table
  bot.pathfinder.setMovements(defaultMoves)
  try {
    await bot.pathfinder.goto(new goals.GoalGetToBlock(craftingTable.position.x, craftingTable.position.y, craftingTable.position.z))
  } catch (e) {
    // just make another one
    console.log('can not get path to old crafting table, making another')
    await collectNblocks(bot, 1, log_block_ids, 256)
    await craftItems(bot, [mcData.itemsByName.crafting_table.id], 1, null)
  }

  console.log('create pickaxe start')
  await craftItems(bot, [mcData.itemsByName.wooden_pickaxe.id], 1, craftingTable)
  console.log('create pickaxe done')
  // take the crafting table with us
  await new Promise((resolve, reject) => {
    bot.collectBlock.collect(craftingTable, (err) => {
      if (err) {
        console.log({failedToCollectCraftingTable: err})
        reject(err)
      } else {
        resolve()
      }
    })
  })

  // make a stone pick
  let existingCobbleCount = itemCountOfBlocksInInventory(bot, mcData, cobbleDroppingBlockIds);
  let cobbleCollectCount = 3 - existingCobbleCount;
  if (cobbleCollectCount > 0) await collectNblocks(bot, cobbleCollectCount, cobbleDroppingBlockIds, 64)
  await craftItems(bot, plank_item_ids, 1, null)
  await craftItems(bot, [mcData.itemsByName.stick.id], 1, null)
  // place the crafting table and use it
  console.log('place crafting table')
  craftingTable = await placeBlockInReachableLocation(bot, mcData, mcData.itemsByName.crafting_table.id)
  console.log('create pickaxe start')
  await craftItems(bot, [mcData.itemsByName.stone_pickaxe.id], 1, craftingTable)
  console.log('create pickaxe done')
  // take the crafting table with us
  await new Promise((resolve, reject) => {
    bot.collectBlock.collect(craftingTable, (err) => {
      if (err) {
        console.log({failedToCollectCraftingTable: err})
        reject(err)
      } else {
        resolve()
      }
    })
  })

  // collect blocks for furnace
  console.log('get some stone')
  // TODO: make this get if not in inventory. Handle clamins on items
  existingCobbleCount = itemCountOfBlocksInInventory(bot, mcData, cobbleDroppingBlockIds);
  cobbleCollectCount = 8 - existingCobbleCount;
  if (cobbleCollectCount > 0) await collectNblocks(bot, cobbleCollectCount, cobbleDroppingBlockIds, 64)

  // make a bucket and flint and steel
  await collectNblocks(bot, 4, [mcData.blocksByName.iron_ore.id], 256)
  // place the crafting table and use it
  craftingTable = await placeBlockInReachableLocation(bot, mcData, mcData.itemsByName.crafting_table.id)
  // Need these planks to get better smelt effeciency
  await craftItems(bot, plank_item_ids, 1, craftingTable)
  await craftItems(bot, [mcData.itemsByName.furnace.id], 1, craftingTable)
  let furnace = await placeBlockInReachableLocation(bot, mcData, mcData.itemsByName.furnace.id)
  console.log('smelt start')
  const bakeTime = await beginSmeltItems(bot, mcData, mcData.itemsByName.iron_ore.id, 4, furnace)
  const bakeTimer = new Promise(r => setTimeout(r, bakeTime));

  // Craft a shovel and get some gravel in the meantime
  // make a stone pick
  existingCobbleCount = itemCountOfBlocksInInventory(bot, mcData, cobbleDroppingBlockIds);
  cobbleCollectCount = 1 - existingCobbleCount;
  if (cobbleCollectCount > 0) await collectNblocks(bot, cobbleCollectCount, cobbleDroppingBlockIds, 64)
  console.log('create stone shovel start')
  await craftItems(bot, [mcData.itemsByName.stone_shovel.id], 1, craftingTable)
  console.log('create stone shovel start')
  // minecraft-data doesn't understand that gravel can drop flint
  let existingGravelCount = itemCountOfBlocksInInventory(bot, mcData, [mcData.blocksByName.gravel.id]);
  let gravelCollectCount = 3 - existingGravelCount;
  if (gravelCollectCount > 0) await collectNblocks(bot, gravelCollectCount, [mcData.blocksByName.gravel.id], 64)

  // Go back to the furnace
  bot.pathfinder.setMovements(defaultMoves)
  await bot.pathfinder.goto(new goals.GoalGetToBlock(furnace.position.x, furnace.position.y, furnace.position.z))
  await bakeTimer
  await endSmeltItems(bot, furnace)
  console.log('smelt end')
  console.log('create bucket start')
  await craftItems(bot, [mcData.itemsByName.bucket.id], 1, craftingTable)
  console.log('create bucket done')
  // take the crafting table with us
  await new Promise((resolve, reject) => {
    bot.collectBlock.collect(craftingTable, (err) => {
      if (err) {
        console.log({failedToCollectCraftingTable: err})
        reject(err)
      } else {
        resolve()
      }
    })
  })
  // take the furnace too
  await new Promise((resolve, reject) => {
    bot.collectBlock.collect(furnace, (err) => {
      if (err) {
        console.log({failedToCollectFurnace: err})
        reject(err)
      } else {
        resolve()
      }
    })
  })

  // get water and find lava
  // await slurpNearestFluidIntoBucket(bot, mcData, mcData.blocksByName.water.id, 128)
  // TODO: this goal isn't quite right. The bot doesn't make it 
  await slurpNearestFluidIntoBucket(bot, mcData, mcData.blocksByName.lava.id, 256)

  console.log('WOWOWOWOWOOWOWOW')
}
