import control, {clearedState, cloneState, stateDiff, executeState, CompositeKeyStateMap} from './gui_direct_control.js';
import {calibrationResults} from './calibration_results.js';
import {HighLevelControl, Scope} from './high_level_control.js';

// From some testing this value seems about right.
const WINDOW_TRANSITION_TIME_MILLISECONDS = 40;

export class PacketToGUI {
  private mineflayerBot;
  private highLevelControl: HighLevelControl;
  // TODO: remove bot. This is just here for testing window clicking.
  constructor(mineflayerBotClient, mineflayerBot, highLevelControl: HighLevelControl) {
    mineflayerBotClient.on('packet', this.handlePacketFromClient.bind(this));
    mineflayerBot._client.on('packet', this.handlePacketToClient.bind(this));
    this.highLevelControl = highLevelControl;
    this.mineflayerBot = mineflayerBot;
  }

  async handlePacketToClient(data, meta) {
    if (meta.name === 'open_window') {
      await this.highLevelControl.exlusiveGUI(new Set(['movement']), async (currentScope, currentState, executeGlobalState, setScope) => {
        console.log('open window');
        await control.wait(WINDOW_TRANSITION_TIME_MILLISECONDS);
        setScope('inventory');
      });
    }
  }

  async handlePacketFromClient(data, meta) {
    if (meta.name === 'held_item_slot') {
      // TODO: confirm that the bot.quickBarSlot value is in sync with this.
      // console.log({
      //   event: 'from_bot',
      //   meta,
      //   ...data,
      // });
      await this.highLevelControl.exlusiveGUI(new Set(['movement']), async (currentScope, currentState, executeGlobalState) => {
        console.log('select hot bar item');
        await this.activateSlot(data.slotId, currentState, executeGlobalState);
        console.log('select hot bar item done');
      });
    }
    // This is what minecraft sends when we attempt to open a chest or furnace for example.
    //
    if (meta.name === 'block_place') {
      // console.log({
      //   event: 'from_bot',
      //   meta,
      //   ...data,
      // });
      await this.highLevelControl.exlusiveGUI(new Set(['movement']), async (currentScope, currentState, executeGlobalState) => {
        // TODO: if we were sneaking then we should continue to do so.
        // How do you tell if we should be sneaking or not?
        // This same packet is sent for both placing and interacting with blocks.
        // await control.wait(20);
        // TODO: use the correct mouse button based on data.
        console.log('block place')
        console.log({currentState});
        const clickState = control.rightClickDown(currentState);
        await executeGlobalState(clickState);
        // TODO: ensure the button is held long enough for the block to place.
        await control.wait(20);
        // TODO: ensure only one block is placed during this.
        await executeGlobalState(currentState);
        // Doing this too fast seems to cause issues with reliability.
        await control.wait(40);
        // Wait for the window to open
        // TODO: handle the scope from differnt block types. Interactable vs non interactable vs inventory based.
        // await this.highLevelControl.setScope('inventory');
        // await control.wait(40);
      })
    }
    if (meta.name === 'window_click') {
      console.log({
        event: 'from_bot window_click',
        meta,
        ...data,
      });
      // TODO: confirm if the inventory windowId is always 0
      await this.highLevelControl.exlusiveGUI(new Set(['movement', 'inventory']), async (currentScope, currentState, executeGlobalState, setScope) => {
        console.log('click window start');
        if (data.windowId === 0 && currentScope === 'movement') {
          console.log('open inventory');
          await this.openInventory();
          setScope('inventory');
          console.log('open inventory done');
        }
        await this.clickWindow(data.mode, data.mouseButton, data.slot);
        console.log('click window done');
      });
    }
    // TODO: I think I can delete this open_window and use the one on the bot._client above.
    if (meta.name === 'open_window') {
      // console.log({
      //   event: 'from_bot',
      //   meta,
      //   ...data,
      // });
      await this.highLevelControl.exlusiveGUI(new Set(['movement']), async (currentScope, currentState, executeGlobalState, setScope) => {
        console.log('open window');
        setScope('inventory');
        console.log('open window done');
      });
    }
    // mineflayer doesn't close the inventory, but we need to.
    // This requires a change to all the mineflayer simple inventory operations.
    // https://github.com/PrismarineJS/mineflayer/blob/487c9a3f579d429de0af7fa6415b585ffcd372ee/lib/plugins/simple_inventory.js#L52
    // Where at the end of every call we close the inventory. This is the behavior
    // of the vanilla client.
    if (meta.name === 'close_window') {
      // console.log({
      //   event: 'from_bot',
      //   meta,
      //   ...data,
      // });
      await this.highLevelControl.exlusiveGUI(new Set(['inventory']), async (currentScope, currentState, executeGlobalState, setScope) => {
        console.log('close window');
        await this.closeWindow();
        // console.log('close window done');
        setScope('movement');
        console.log('close window done');
      });
    }
  }

  async activateSlot(slotId: number, currentState, executeGlobalState) {
    switch (slotId) {
      case 0:
        await executeGlobalState(control.oneDown(currentState));
        break;
      case 1:
        await executeGlobalState(control.twoDown(currentState));
        break;
      case 2:
        await executeGlobalState(control.threeDown(currentState));
        break;
      case 3:
        await executeGlobalState(control.fourDown(currentState));
        break;
      case 4:
        await executeGlobalState(control.fiveDown(currentState));
        break;
      case 5:
        await executeGlobalState(control.sixDown(currentState));
        break;
      case 6:
        await executeGlobalState(control.sevenDown(currentState));
        break;
      case 7:
        await executeGlobalState(control.eightDown(currentState));
        break;
      case 8:
        await executeGlobalState(control.nineDown(currentState));
        break;
      default:
        throw new Error(`Cannot activate slotId not in 0-8 '${slotId}'`);
    }
    await executeGlobalState(currentState);
  }

  async openInventory() {
    await executeState(control.openInventoryDown(clearedState()));
    await executeState(clearedState());
    // Need to wait a short bit for the inventory to open up.
    await control.wait(WINDOW_TRANSITION_TIME_MILLISECONDS);
  }

  async closeWindow() {
    await executeState(control.closeWindowDown(clearedState()));
    await executeState(clearedState());
    await control.wait(WINDOW_TRANSITION_TIME_MILLISECONDS);
    await control.jiggleMouseHackPleaseFix();
  }

  async clickWindow(mode: number, mouseButton: number, slot: number) {
    if (mode !== 0) {
      throw new Error(`mode '${mode}' is not implemented yet.`);
    }
    let mouseCLickState = clearedState();
    switch (mouseButton) {
      case 0:
        mouseCLickState = control.leftClickDown(clearedState());
        break;
      case 1:
        mouseCLickState = control.rightClickDown(clearedState());
        break;
      default:
        throw new Error(`mouseButton '${mouseButton}' is not implemented yet.`);
    }
    const windowType = this.currentWindowType();
    // console.log('start move to slot');
    await this.moveCursorToSlotForWindowType(slot, windowType);
    // console.log('end move to slot');
    // console.log('start click');
    await executeState(mouseCLickState);
    // console.log('end click');
    //  console.log('start clear click');
    await executeState(clearedState());
    // console.log('end clear click');
  }

  currentWindowType(): string {
    return (this.mineflayerBot.currentWindow || this.mineflayerBot.inventory).type;
  }

  async moveCursorToSlotForWindowType(slot: number, windowType: string) {
    const [posX, posY] = this.slotPositionForWindowType(slot, windowType);
    // console.log({slot, posX, posY});
    await control.moveMouse(posX, posY);
  }

  slotPositionForWindowType(slot: number, windowType: string): [number, number] {
    const windowPositions = calibrationResults[windowType];
    if (windowPositions == null) {
      throw new Error(`windowType '${windowType}' slot positions are not implemented`);
    }
    const {x, y} = windowPositions[slot];
    if (x == null || y == null) {
      throw new Error(`slot '${slot}' does not exist in window minecraft:inventory`);
    }
    return [x, y];
  }
}
