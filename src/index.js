import getConfig from './lib/config.js';
import setupPromClient from './lib/prom_setup.js';
import {logger} from './lib/logger.js';

// process.on('unhandledRejection', r => {
//   console.log({r})
// });

// TODO: add the graphql port into this
const config = getConfig();

const [promClient, promRegister] = setupPromClient(config.metricsPort, config.speedrunId);

import data from 'minecraft-data';
import mineflayer from 'mineflayer';
import {EventLogger, eventLoggerChatControl} from './lib/detailed_logging.js';
import {mineflayer as mineflayerViewer} from 'prismarine-viewer';
import testing from './lib/testing.js';

import repl from 'repl';

const bot = mineflayer.createBot({
  host: config.mcServerHost,
  port: config.mcServerPort,
  username: 'Player'
});

bot.once('spawn', () => {
  console.log('spawn');
  const mcData = data(bot.version);
  const eventLogger = new EventLogger(bot, mcData);
  eventLogger.enable('digging');
  bot.on('chat', eventLoggerChatControl(bot, eventLogger));

  bot.on('chat', (username, message) => {
    if (username === bot.username) {
      return;
    }
    if (message.includes('test')) {
      testing(bot, mcData).catch(logger.info);
    }
    if (message.includes('STOP')) {
      bot.quit();
      // TODO: find out why viewer prevents graceful exit even when close() is called.
      // https://github.com/PrismarineJS/prismarine-viewer/blob/6d527e3d6d6646acfa6c79fc7fa9e2afadb98cf8/lib/mineflayer.js#L85
      process.exit(0)
    }
    if (message.includes('REPL')) {
      const context = repl.start('> ').context;
      context.bot = bot;
      context.mcData = mcData;
    }
    if (message.includes('view')) {
      mineflayerViewer(bot, {port: config.viewerPort});
    }
  });
});
