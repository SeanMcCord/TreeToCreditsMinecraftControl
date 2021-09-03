import control, {executeState, clearedState} from './gui_direct_control.js';

// TODO: encapsulate the knowledge of the ui positions
const respawnButton = {x: Math.floor(1920 / 2), y: 440};

export const respawn = async () => {
  console.log('waiting for respawn button to be clickable');
  await control.wait(500);
  await control.moveMouse(respawnButton.x, respawnButton.y);
  await control.wait(1000);
  console.log('clicking respawn button');
  await executeState(control.leftClickDown(clearedState()));
  await executeState(clearedState());

  // TODO: consider handling the case when the button is not pressed
}
