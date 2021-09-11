import control, {clearedState, cloneState, stateDiff, executeState, CompositeKeyStateMap} from './gui_direct_control.js';
import {calibrationResults} from './calibration_results.js';
import {HighLevelControl, Scope} from './high_level_control.js';

export class PacketToGUI {
  private mineflayerBot;
  private highLevelControl: HighLevelControl;
  // TODO: remove bot. This is just here for testing window clicking.
  constructor(mineflayerBotClient, mineflayerBot, highLevelControl: HighLevelControl) {
    mineflayerBotClient.on('packet', this.handlePacket.bind(this));
    this.highLevelControl = highLevelControl;
    this.mineflayerBot = mineflayerBot;
  }

  async handlePacket(data, meta) {
    if (meta.name === 'transaction') {
      console.log({
        event: 'from_bot',
        meta,
        ...data,
      });
    }
    if (meta.name === 'held_item_slot') {
      // console.log({
      //   event: 'from_bot',
      //   meta,
      //   ...data,
      // });
      console.log('select hot bar item');
      await this.highLevelControl.exlusiveGUI(new Set(['movement']), async () => {
        await this.activateSlot(data.slotId);
      });
    }
    // This is what minecraft sends when we attempt to open a chest or furnace for example.
    //
    if (meta.name === 'block_place') {
      console.log({
        event: 'from_bot',
        meta,
        ...data,
      });
      await this.highLevelControl.exlusiveGUI(new Set(['movement']), async (currentScope, currentState, executeGlobalState) => {
        // TODO: if we were sneaking then we should continue to do so.
        // How do you tell if we should be sneaking or not?
        // This same packet is sent for both placing and interacting with blocks.
        // await control.wait(20);
        // TODO: use the correct mouse button based on data.
        const clickState = control.rightClickDown(currentState);
        await executeGlobalState(clickState);
        await executeGlobalState(clearedState());
        // Wait for the window to open
        // TODO: handle the scope from differnt block types. Interactable vs non interactable vs inventory based.
        // await this.highLevelControl.setScope('inventory');
        // await control.wait(40);
      })
    }
    if (meta.name === 'window_click') {
      // console.log({
      //   event: 'from_bot',
      //   meta,
      //   ...data,
      // });
      // TODO: confirm if the inventory windowId is always 0
      await this.highLevelControl.exlusiveGUI(new Set(['movement', 'inventory']), async (currentScope) => {
        if (data.windowId === 0 && currentScope === 'movement') {
          console.log('open inventory');
          await this.openInventory();
          console.log('open inventory done');
          await this.highLevelControl.setScope('inventory');
        }
        await this.clickWindow(data.mode, data.mouseButton, data.slot);
      });
    }
    // mineflayer doesn't close the inventory, but we need to.
    // This requires a change to all the mineflayer simple inventory operations.
    // https://github.com/PrismarineJS/mineflayer/blob/487c9a3f579d429de0af7fa6415b585ffcd372ee/lib/plugins/simple_inventory.js#L52
    // Where at the end of every call we close the inventory. This is the behavior
    // of the vanilla client.
    if (meta.name === 'open_window') {
      console.log({
        event: 'from_bot',
        meta,
        ...data,
      });
      await this.highLevelControl.exlusiveGUI(new Set(['movement']), async () => {
        await this.highLevelControl.setScope('inventory');
      });
    }
    if (meta.name === 'close_window') {
      console.log({
        event: 'from_bot',
        meta,
        ...data,
      });
      await this.highLevelControl.exlusiveGUI(new Set(['inventory']), async () => {
        // console.log('close window');
        await this.closeWindow();
        // console.log('close window done');
        await this.highLevelControl.setScope('movement');
      });
    }
  }

  async activateSlot(slotId: number) {
    switch (slotId) {
      case 0:
        await executeState(control.oneDown(clearedState()));
        break;
      case 1:
        await executeState(control.twoDown(clearedState()));
        break;
      case 2:
        await executeState(control.threeDown(clearedState()));
        break;
      case 3:
        await executeState(control.fourDown(clearedState()));
        break;
      case 4:
        await executeState(control.fiveDown(clearedState()));
        break;
      case 5:
        await executeState(control.sixDown(clearedState()));
        break;
      case 6:
        await executeState(control.sevenDown(clearedState()));
        break;
      case 7:
        await executeState(control.eightDown(clearedState()));
        break;
      case 8:
        await executeState(control.nineDown(clearedState()));
        break;
      default:
        throw new Error(`Cannot activate slotId not in 0-8 '${slotId}'`);
    }
    await executeState(clearedState());
  }

  async openInventory() {
    await executeState(control.openInventoryDown(clearedState()));
    await executeState(clearedState());
    // Need to wait a short bit for the inventory to open up.
    await control.wait(80);
  }

  async closeWindow() {
    await executeState(control.closeWindowDown(clearedState()));
    await executeState(clearedState());
    await control.wait(40);
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
