// TODO: add error handling to add/remove of listeners
export class EventLogger {
  static #RESERVED_EVENT_GROUP_NAMES = ['all']
  constructor(bot, mcData) {
    this.bot = bot
    this.mcData = mcData
    this.groupMap = new Map()
    this.addGroup('pathfinder', pathfinderLoggingGroup())
    this.addGroup('blockBreaking', blockBreakingLoggingGroup())
    this.addGroup('digging', diggingLoggingGroup())
    this.addGroup('inventory', inventoryLoggingGroup())
    this.addGroup('detailedInventory', detailedInventoryLoggingGroup())
    this.addGroup('crafting', craftLoggingGroup())
  }

  enable(eventGroupName) {
    this.#throwErrorOnMissingGroupName(eventGroupName)
    const group = this.groupMap.get(eventGroupName)
    // No need to add listeners
    if (group.state == true) return
    for (const [eventName, functions] of group.functionsMap) {
      for (const func of functions) {
        this.bot.on(eventName, func)
      }
    }
    group.state = true
  }

  disable(eventGroupName) {
    this.#throwErrorOnMissingGroupName(eventGroupName)
    const group = this.groupMap.get(eventGroupName)
    // No need to add listeners
    if (group.state == false) return
    for (const [eventName, functions] of group.functionsMap) {
      for (const func of functions) {
        this.bot.removeListener(eventName, func)
      }
    }
    group.state = false
  }

  toggle(eventGroupName) {
    this.#throwErrorOnMissingGroupName(eventGroupName)
    if (this.groupMap.get(eventGroupName).state == true) {
      this.disable(eventGroupName)
    } else {
      this.enable(eventGroupName)
    }
  }

  enableAll() {
    for (const eventGroupName of this.groupMap.keys()) {
      this.enable(eventGroupName)
    }
  }

  disableAll() {
    for (const eventGroupName of this.groupMap.keys()) {
      this.disable(eventGroupName)
    }
  }

  // functionMap is a map with key eventName and value function[]
  addGroup(eventGroupName, functionsMap) {
    if (EventLogger.#RESERVED_EVENT_GROUP_NAMES.includes(eventGroupName)) {
      throw new Error(`group name ${eventGroupName} is reserved and may not be used`)
    }
    if (this.groupMap.has(eventGroupName)) {
      throw new Error(`group name ${eventGroupName} already exists`)
    }
    this.groupMap.set(eventGroupName, {state: false, functionsMap})
  }

  #throwErrorOnMissingGroupName(eventGroupName) {
    if (this.groupMap.has(eventGroupName)) return
    throw new Error(`group name ${eventGroupName} not found`)
  }
}

// This will be called once to get a mapping between event names and functions to call.
const pathfinderLoggingGroup = () => {
  const mapping = new Map()
  mapping.set('goal_reached', [(...args) => {
    console.log({pathfinder: {goalReached: [...args]}})
  }])
  mapping.set('path_update', [(...args) => {
    console.log({pathfinder: {pathUpdate: {...args['0']}, path: {...args['0'].path['0']}}})
  }])
  mapping.set('goal_updated', [(...args) => {
    console.log({pathfinder: {goalUpdated: {...args}}})
  }])
  mapping.set('path_reset', [(...args) => {
    console.log({pathfinder: {pathReset: {...args}}})
  }])
  return mapping
}

const blockBreakingLoggingGroup = () => {
  const mapping = new Map()
  mapping.set('blockBreakProgressObserved', [(...args) => {
    console.log({digging: {blockBreakProgressObserved: args}})
  }])
  return mapping
}

const diggingLoggingGroup = () => {
  const mapping = new Map()
  mapping.set('diggingCompleted', [(...args) => {
    console.log({digging: {diggingCompleted: args}})
  }])
  // I added this one to digging.js
  mapping.set('diggingTimeEstimate', [(...args) => {
    console.log({digging: {diggingTimeEstimate: args}})
  }])
  return mapping
}

const inventoryLoggingGroup = () => {
  const mapping = new Map()
  mapping.set('slotUpdate', [(...args) => {
    console.log({slotUpdate: args})
  }])
  mapping.set('heldItemChanged', [(...args) => {
    console.log({heldItemChanged: args})
  }])
  mapping.set('windowOpen', [(...args) => {
    console.log({windowOpen: args})
  }])
  mapping.set('windowClose', [(...args) => {
    console.log({windowClose: args})
  }])
  return mapping
}

const detailedInventoryLoggingGroup = () => {
  const mapping = new Map()
  // I added this to inventory.js
  mapping.set('inventoryPutAway', [(...args) => {
    console.log({inventoryPutAway: args})
  }])
  return mapping
}

const craftLoggingGroup = () => {
  const mapping = new Map()
  // I added this to craft.js
  mapping.set('craftingOnceRecipe', [(...args) => {
    console.log({craftingOnceRecipe: args})
  }])
  // I added this to craft.js
  mapping.set('craftPutMaterialsAway', [(...args) => {
    console.log({craftPutMaterialsAway: args})
  }])
  // I added this to craft.js
  mapping.set('craftGrabResult', [(...args) => {
    console.log({craftGrabResult: args})
  }])
  return mapping
}

// Keeping the seperate from the EventLogger as I think others may perfer alternative start methods
// TODO: make this generic
export const eventLoggerChatControl = (bot, eventLogger) => {
  return (username, message) => {
    if (username === bot.username) return
    if (message.startsWith('elog')) {
      const elogArgs = message.trim().split(" ")
      if (elogArgs.length != 3) return
      if (elogArgs[1] == 'enable') {
        if (elogArgs[2] == 'all') {
          eventLogger.enableAll()
        } else {
          eventLogger.enable(elogArgs[2])
        }
      } else if (elogArgs[1] == 'disable') {
        if (elogArgs[2] == 'all') {
          eventLogger.disableAll()
        } else {
          eventLogger.disable(elogArgs[2])
        }
      } else if (elogArgs[1] == 'toggle') {
        eventLogger.toggle(elogArgs[2])
      }
    }
  }
}
