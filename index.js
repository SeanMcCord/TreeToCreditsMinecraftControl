import http from 'http';
import url from 'url';
import client from 'prom-client';
import {logger} from './lib/logger.js';

// Create a Registry which registers the metrics
const register = new client.Registry()

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'example-nodejs-app'
})

// Enable the collection of default metrics
client.collectDefaultMetrics({register})

// Define the HTTP server
const server = http.createServer(async (req, res) => {
  // Retrieve route from request object
  const route = url.parse(req.url).pathname

  if (route === '/metrics') {
    // Return all metrics the Prometheus exposition format
    res.setHeader('Content-Type', register.contentType)
    res.end(await register.metrics())
  }
})

// Start the HTTP server which exposes the metrics on http://localhost:8080/metrics
server.listen(8080)

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

import repl from 'repl';

const bot = mineflayer.createBot({
  host: '192.168.1.163',
  username: 'Player'
});

bot.loadPlugin(collectblock);
bot.loadPlugin(pvp);
bot.loadPlugin(autoeat);

bot.once('spawn', () => {
  const mcData = data(bot.version);
  const eventLogger = new EventLogger(bot, mcData);
  // eventLogger.enable('autoeat');
  // eventLogger.enable('pathfinderNodeTime');
  eventLogger.enable('pathfinder');
  //eventLogger.enable('digging');
  bot.on('chat', eventLoggerChatControl(bot, eventLogger));
  mineflayerViewer(bot, {port: 3001});
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
      testing(bot, mcData).catch(logger.info);
    }
    if (message.includes('STOP')) {
      bot.quit();
      // TODO: find out why viewer prevents graceful exit even when close() is called.
      // https://github.com/PrismarineJS/prismarine-viewer/blob/6d527e3d6d6646acfa6c79fc7fa9e2afadb98cf8/lib/mineflayer.js#L85
    }
    if (message.includes('REPL')) {
      const context = repl.start('> ').context;
      context.bot = bot;
      context.mcData = mcData;
    }
    if (message.includes('view')) {
      mineflayerViewer(bot, {port: 3001});
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

