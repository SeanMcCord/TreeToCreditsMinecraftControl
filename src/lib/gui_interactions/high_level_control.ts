import control, {executeState, clearedState} from './gui_direct_control.js';
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

class HighLevelControl {
  constructor() {
  }
}
