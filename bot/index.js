// CommandCenter AI — Telegram Bot Entry Point
const { Telegraf, session } = require('telegraf');
const config = require('../server/config/env');

// ── Command Handlers ──
const startCmd = require('./commands/start');
const helpCmd = require('./commands/help');
const crmCmd = require('./commands/crm');
const leadCmd = require('./commands/lead');
const contentCmd = require('./commands/content');
const socialCmd = require('./commands/social');
const taskCmd = require('./commands/task');
const agentCmd = require('./commands/agent');
const reportCmd = require('./commands/report');

let bot = null;

/**
 * Auth middleware — locks the bot to the single owner defined in env.
 * Any message from another user is silently ignored (with a polite reply once).
 */
function authMiddleware(ctx, next) {
  const ownerId = config.telegram.ownerId;
  if (!ownerId) {
    // No owner ID configured — allow all (dev mode)
    return next();
  }
  const userId = String(ctx.from?.id || '');
  if (userId === String(ownerId)) {
    return next();
  }
  // Unauthorized user
  return ctx.reply('⛔ Access denied. This bot is private.');
}

/**
 * Start the bot with long-polling.
 */
function startBot() {
  if (!config.telegram.botToken) {
    console.log('⚠️  Cannot start bot: TELEGRAM_BOT_TOKEN is not set');
    return;
  }

  bot = new Telegraf(config.telegram.botToken);

  // ── Middleware ──
  bot.use(session());
  bot.use(authMiddleware);

  // ── Intercept Keyboard Buttons ──
  bot.use((ctx, next) => {
    if (ctx.message && ctx.message.text) {
      const buttonMap = {
        '📇 CRM Contacts': '/crm list',
        '✅ My Tasks': '/task list',
        '📝 Content Ideas': '/content list',
        '🤖 Agent Status': '/agent status',
        '📊 Daily Report': '/report daily',
        '⚙️ Help': '/help',
      };
      if (buttonMap[ctx.message.text]) {
        ctx.message.text = buttonMap[ctx.message.text];
      }
    }
    return next();
  });

  // ── Error handler ──
  bot.catch((err, ctx) => {
    console.error(`❌ Bot error for ${ctx.updateType}:`, err.message);
    ctx.reply('⚠️ Something went wrong. Please try again.').catch(() => {});
  });

  // ── Register Commands ──
  startCmd(bot);
  helpCmd(bot);
  crmCmd(bot);
  leadCmd(bot);
  contentCmd(bot);
  socialCmd(bot);
  taskCmd(bot);
  agentCmd(bot);
  reportCmd(bot);

  // ── Free-form AI Chat — catch all non-command text messages ──
  bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith('/')) return;

    await ctx.sendChatAction('typing').catch(() => {});

    try {
      const orchestrator = require('../agents/orchestrator');
      const result = await orchestrator.processCommand(text, {
        userId: ctx.from.id,
        userName: ctx.from.first_name,
        source: 'telegram',
      });

      // Handle image generation
      if (result.intent === 'image') {
        await ctx.reply('🎨 Generating your image...');
        await ctx.sendChatAction('upload_photo').catch(() => {});

        try {
          const imageGen = require('../integrations/imageGen');
          // Extract the actual image prompt (remove "generate image of" etc.)
          const prompt = text.replace(/^(generate|create|make|draw|design)\s*(an?\s*)?(image|picture|photo|artwork|poster|banner|logo)\s*(of|about|for|showing)?\s*/i, '').trim() || text;
          
          const { filepath } = await imageGen.generateAndSave(prompt);
          await ctx.replyWithPhoto({ source: filepath }, { caption: `🎨 ${prompt}` });
        } catch (imgErr) {
          console.error('Image gen error:', imgErr.message);
          await ctx.reply('Could not generate the image. Try again with a different description.');
        }
        return;
      }

      // Extract clean text
      let response = typeof result.response === 'string' ? result.response : (result.response?.text || result.response?.content || String(result.response || ''));

      // Catch raw JSON leaks
      if (response.startsWith('{') && response.includes('"text"')) {
        try { response = JSON.parse(response).text || response; } catch (e) {}
      }

      // Send clean response (plain text, no heavy formatting)
      await ctx.reply(response, { disable_web_page_preview: true });
    } catch (err) {
      console.error('Chat error:', err.message);
      await ctx.reply('Something went wrong. Try again.');
    }
  });

  // ── Callback query router (inline keyboard actions) ──
  // Each command module registers its own actions, but we add a fallback:
  bot.on('callback_query', (ctx) => {
    ctx.answerCbQuery('Action not recognised').catch(() => {});
  });

  // ── Launch with polling ──
  bot.launch({ dropPendingUpdates: true });
  console.log('🤖 Telegram bot started (polling mode)');

  // ── Graceful shutdown ──
  const shutdown = (signal) => {
    console.log(`\n🛑 Received ${signal} — stopping bot…`);
    bot.stop(signal);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = { startBot };
