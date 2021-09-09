import {startProxy} from './proxy.js';
import Agent from './agent.js';
import {connectToServer} from './gui_interactions/gui_connect_to_server.js';
import repl from 'repl';

const mineflayerViewerPort = 3011;
const replEnabled = process.env.REPL

const botPromise = startProxy();

connectToServer();

botPromise.then(([bot, highLevelControl]) => {
  const agent = new Agent(bot, highLevelControl, {mineflayerViewerPort});
  if (replEnabled) {
    console.log('Created Mineflayer instance')
    const context = repl.start('> ').context;
    context.bot = bot;
    context.agent = agent;
  }
})
