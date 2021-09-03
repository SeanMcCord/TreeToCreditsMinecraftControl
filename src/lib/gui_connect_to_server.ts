import control, {executeState, clearedState} from './gui_direct_control.js';

const backToServerList = {x: Math.floor(1920 / 2), y: 580};
const topServer = {x: 700, y: 150};

export const connectToServer = async () => {
  // Click Back to Server List
  await control.moveMouse(backToServerList.x, backToServerList.y);
  await executeState(control.leftClickDown(clearedState()));
  await executeState(clearedState());

  await control.moveMouse(topServer.x, topServer.y);
  await executeState(control.leftClickDown(clearedState()));
  await executeState(clearedState());
}
