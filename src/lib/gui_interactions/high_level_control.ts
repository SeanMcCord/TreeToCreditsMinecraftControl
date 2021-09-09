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

export class HighLevelControl {
  private currentState = clearedState();
  private mutex = new Mutex();
  constructor() {
  }

  async exlusiveGUI(callback) {
    await this.mutex.runExclusive(async () => {
      await callback()
    });
  }

  async executeState(targetState) {
    await this.mutex.runExclusive(async () => {
      await executeState(targetState);
      this.currentState = targetState;
    });
  }
}
