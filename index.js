import getConfig from './lib/config.js';
import setupPromClient from './lib/prom_setup.js';
import {logger} from './lib/logger.js';

process.on('unhandledRejection', r => {
  console.log({r})
});

// TODO: add the graphql port into this
const config = getConfig();

const [promClient, promRegister] = setupPromClient(config.metricsPort, config.speedrunId);

import data from 'minecraft-data';
import mineflayer from 'mineflayer';
import {plugin as collectblock} from 'mineflayer-collectblock';
import {EventLogger, eventLoggerChatControl} from './lib/detailed_logging.js';
import {mineflayer as mineflayerViewer} from 'prismarine-viewer';
import mainWork from './lib/main_work.js';
import testing from './lib/testing.js';
import pathfinderViewer from './lib/pathfinder_viewer.js';
import autoeat from 'mineflayer-auto-eat';
import {plugin as pvp} from 'mineflayer-pvp';
import registerPathfinderCalculationMetrics from './lib/detailed_metrics.js';

import repl from 'repl';

const bot = mineflayer.createBot({
  host: config.mcServerHost,
  port: config.mcServerPort,
  username: 'Player'
});

registerPathfinderCalculationMetrics(bot, promClient, promRegister);

bot.loadPlugin(collectblock);
bot.loadPlugin(pvp);
bot.loadPlugin(autoeat);

bot.once('spawn', () => {
  const mcData = data(bot.version);
  const eventLogger = new EventLogger(bot, mcData);
  // eventLogger.enable('autoeat');
  eventLogger.enable('pathfinderMoveTime');
  eventLogger.enable('pathfinder');
  eventLogger.enable('digging');
  bot.on('chat', eventLoggerChatControl(bot, eventLogger));
  mineflayerViewer(bot, {firstPerson: true, port: config.viewerPort});
  pathfinderViewer(bot);
  mainWork(bot, mcData).catch(logger.info);

  bot.on('chat', (username, message) => {
    if (username === bot.username) {
      return;
    }
    if (message.includes('start')) {
      mainWork(bot, mcData).catch(logger.info);
    }
    if (message.includes('test')) {
      testing(bot, mcData, config.vectorAPIPort).catch(logger.info);
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
      pathfinderViewer(bot);
    }
  });
  bot.autoEat.options = {
    priority: 'foodPoints',
    startAt: 14,
    bannedFood: [],
  }
  bot.on('health', () => {
    // logger.info({food: bot.food, health: bot.health});
    if (bot.food === 20) {
      bot.autoEat.disable();
      bot.autoEat.options.startAt = 14;
    } else {
      if (bot.health < 15) {
        bot.autoEat.options.startAt = 20;
      }
      bot.autoEat.enable();
    }
  });
});

