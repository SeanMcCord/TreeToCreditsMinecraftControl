import control, {executeState, clearedState} from './gui_direct_control.js';
import {Mutex, MutexInterface, Semaphore, SemaphoreInterface, withTimeout} from 'async-mutex';
// There are two primary constraints guiding this design.
// 1: GUI interactions are executed sequentially.
// 2: Buttons are stateful.
//
// Assumptions
// 1: GUI interactions will be mediated by xdotool[0]
// [0] https://github.com/jordansissel/xdotool
//
// Approach taken
// All GUI interactions will be channeled though this singleton object. The goal is to encapsulate the button states
// for fast diffing with desired states for dispatch.

export type Scope = 'inventory' | 'movement';

export class HighLevelControl {
  private currentState = clearedState();
  private mutex = new Mutex();
  private currentScope: Scope = 'movement';
  constructor() {
  }

  async setScope(scope: Scope) {
    // await this.mutex.runExclusive(async () => {
    this.currentScope = scope;
    console.log(`scope set to '${scope}'`);
    // });
  }

  async exlusiveGUI(requiredScope: Set<Scope>, callback) {
    // TODO: consider a less dangerous way of handling conditions. Enforce a timeout perhaps
    let executed = false;
    for (; ;) {
      await this.mutex.runExclusive(async () => {
        if (requiredScope.has(this.currentScope)) {
          await callback(this.currentScope, this.currentState, this.executeState.bind(this));
          executed = true;
        }
      });
      if (executed) {
        return;
      } else {
        console.log(`lock aquired with wrong scope. scope required '${Array.from(requiredScope)}'`);
        await new Promise(r => setTimeout(r, 20));
        // TODO: test if this runs too fast and needs a sleep. I assume it does.
      }
    }
  }

  private async executeState(targetState) {
    await executeState(targetState);
    this.currentState = targetState;
  }
}
