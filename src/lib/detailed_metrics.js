const registerPathfinderCalculationMetrics = (bot, promClient, promRegister) => {
  const pathfinderTime = new promClient.Gauge({
    name: 'pathfinder_computation_time',
    help: 'metric_help',
    registers: [promRegister],
  });
  const pathfinderGeneratedNodes = new promClient.Gauge({
    name: 'pathfinder_computation_generated_nodes',
    help: 'metric_help',
    registers: [promRegister],
  });
  const pathfinderVisitedNodes = new promClient.Gauge({
    name: 'pathfinder_computation_visited_nodes',
    help: 'metric_help',
    registers: [promRegister],
  });
  bot.on('path_update', (result) => {
    pathfinderTime.set(result.time);
    pathfinderGeneratedNodes.set(result.generatedNodes);
    pathfinderVisitedNodes.set(result.visitedNodes);
  });
};

export default registerPathfinderCalculationMetrics;
