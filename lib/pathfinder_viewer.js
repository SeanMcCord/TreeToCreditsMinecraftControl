import vec3 from 'vec3';
const {Vec3} = vec3;

// Sets up listeners to draw the path and goal from pathfinder.
export default (bot) => {
  let pathMemo = []
  setInterval(() => {
    // TODO: find out why drawLine is busted. Seems like an issue with ES5 and three.meshline
    bot.viewer.drawPoints('showThePath', pathMemo, 0x228b22, 8);
  }, 500)
  const pathUpdateViewer = (pathResult) => {
    const pathfinderPath = pathResult.path;
    if (pathfinderPath == null) {
      return;
    }
    const pathNew = pathfinderPath.map((move) => new Vec3(move.x, move.y + 0.5, move.z));
    if (pathNew.length != pathMemo.length) {
      pathNew.every((move, i) => {
        const oldMove = pathMemo[i];
        return oldMove != null && move.x === oldMove.x && move.y === oldMove.y && move.z === oldMove.z
      })
      pathMemo = pathNew;

      // bot.viewer.drawLine('showThePath', pathMemo, 0xfd1616);
      // console.log({pathMemo})
    }
    // console.log({botId: bot.username, pathfinderPath, pathMemo})

    const toBreak = pathfinderPath.flatMap((move) => move.toBreak.map((toBreak) => new Vec3(toBreak.x + 0.5, (toBreak.y) + 0.5, toBreak.z + 0.5)));
    // console.log({botId: bot.username, toBreak })
    bot.viewer.drawPoints('toBreak', toBreak, 0xff9a00, 16);

    const toPlace = pathfinderPath.flatMap((move) => move.toPlace.map((toPlace) => new Vec3(toPlace.x + 0.5, (toPlace.y) + 0.5, toPlace.z + 0.5)));
    // console.log({botId: bot.username, toPlace })
    bot.viewer.drawPoints('toPlace', toPlace, 0xfd16ff, 16);
  }
  bot.on('path_update', pathUpdateViewer)

  const goalUpdatedViewer = (goal, _dynamic) => {
    console.log({goal})
    const extractLocationsFromComposite = (goal) => {
      const extractLocation = (goal) => {
        if (goal.x != null && goal.y != null && goal.z != null) {
          return new Vec3(goal.x + 0.5, goal.y + 0.5, goal.z + 0.5);
        }
      }
      if (goal.goals != null) {
        return goal.goals.map((subGoal) => extractLocation(subGoal));
      } else {
        return [extractLocation(goal)]
      }
    }
    let goalLocations = extractLocationsFromComposite(goal);
    bot.viewer.drawPoints('goal', goalLocations, 0xfd1616, 16)
  }
  bot.on('goal_updated', goalUpdatedViewer)
}
