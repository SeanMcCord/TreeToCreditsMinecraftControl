import data from 'minecraft-data';
import mineflayer from 'mineflayer';
import {plugin as collectblock} from 'mineflayer-collectblock';
import {EventLogger, eventLoggerChatControl} from './lib/detailed_logging.js';
import {mineflayer as mineflayerViewer} from 'prismarine-viewer';
import mainWork from './lib/main_work.js';
import testing from './lib/testing.js';
import pathfinderViewer from './lib/pathfinder_viewer.js';
import autoeat from 'mineflayer-auto-eat';

import repl from 'repl';

const bot = mineflayer.createBot({
  host: '192.168.1.163',
  username: 'Player'
});

bot.loadPlugin(collectblock);
bot.loadPlugin(autoeat)

bot.once('spawn', () => {
  const mcData = data(bot.version);
  const eventLogger = new EventLogger(bot, mcData);
  bot.on('chat', eventLoggerChatControl(bot, eventLogger));

  bot.on('chat', (username, message) => {
    if (username === bot.username) {
      return;
    }
    if (message.includes('start')) {
      mainWork(bot, mcData).catch(console.log);
    }
    if (message.includes('test')) {
      testing(bot, mcData).catch(console.log);
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
      mineflayerViewer(bot, {port: 3000});
      pathfinderViewer(bot);
    }
  });
  bot.autoEat.options = {
    priority: 'foodPoints',
    startAt: 14,
    bannedFood: [],
  }
  bot.on('health', () => {
    if (bot.food === 20) {
      bot.autoEat.disable();
    } else {
      bot.autoEat.enable();
    }
  });
});

