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

  // 1. Global Debug Logger Middleware
  bot.use(async (ctx, next) => {
    const start = Date.now();
    const updateType = ctx.updateType;
    let details = '';
    
    if (ctx.message?.text) {
      details = `Text: "${ctx.message.text}"`;
    } else if (ctx.callbackQuery?.data) {
      details = `Callback: "${ctx.callbackQuery.data}"`;
    }

    console.log(`[Bot Logger] 📥 Incoming ${updateType} from ${ctx.from?.first_name || 'unknown'} (ID: ${ctx.from?.id}) | ${details}`);
    
    await next();

    const wizardState = ctx.session?.wizard ? `Wizard: ${ctx.session.wizard.type} (Step: ${ctx.session.wizard.step})` : 'Wizard: None';
    const duration = Date.now() - start;
    console.log(`[Bot Logger] 📤 Handled ${updateType} in ${duration}ms | ${wizardState}`);
  });

  // 2. Global Wizard Auto-Cancellation Middleware
  bot.use((ctx, next) => {
    if (ctx.session?.wizard?.active) {
      if (ctx.message?.text) {
        const text = ctx.message.text;
        const mainMenuButtons = ['📇 CRM Contacts', '✅ My Tasks', '📝 Content Ideas', '🤖 Agent Status', '📊 Daily Report', '⚙️ Help'];
        if (text.toLowerCase() === '/cancel' || text.toLowerCase() === 'cancel' || mainMenuButtons.includes(text) || text.startsWith('/')) {
          console.log(`[Bot Session] 🧹 Clearing active wizard (${ctx.session.wizard.type}) due to menu interaction/command: "${text}"`);
          ctx.session.wizard = null;
        }
      } else if (ctx.callbackQuery?.data) {
        const data = ctx.callbackQuery.data;
        // If they click any callback that is not wizard-specific, clear wizard
        if (!data.startsWith('wizard_')) {
          console.log(`[Bot Session] 🧹 Clearing active wizard (${ctx.session.wizard.type}) due to non-wizard callback query: "${data}"`);
          ctx.session.wizard = null;
        }
      }
    }
    return next();
  });

  bot.use(authMiddleware);

  // Note: Persistent keyboard buttons ('📇 CRM Contacts', etc.) are handled via native bot.hears() inside their respective command modules to avoid fragile text-mutating routing bugs.

  // ── Error handler ──
  bot.catch((err, ctx) => {
    console.error(`❌ Bot error for ${ctx.updateType}:`, err.message);
    ctx.reply('⚠️ Something went wrong. Please try again.').catch(() => {});
  });

  // ── Dedicated Cancel Commands ──
  bot.command('cancel', (ctx) => {
    ctx.session = ctx.session || {};
    ctx.session.wizard = null;
    return ctx.reply('❌ Cancelled.');
  });

  bot.hears(/^(cancel|\/cancel)$/i, (ctx) => {
    ctx.session = ctx.session || {};
    ctx.session.wizard = null;
    return ctx.reply('❌ Cancelled.');
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

    // ── Check if user is in an active Wizard session ──
    if (ctx.session?.wizard?.active) {
      // Route to the central wizards module
      const wizards = require('./commands/wizards');
      return wizards.handleWizardStep(ctx, text);
    }

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
        const genMsg = await ctx.reply('🎨 Generating your image...');
        await ctx.sendChatAction('upload_photo').catch(() => {});

        try {
          const imageGen = require('../integrations/imageGen');
          // Extract the actual image prompt (remove "generate image of" etc.)
          const prompt = text.replace(/^(generate|create|make|draw|design)\s*(an?\s*)?(image|picture|photo|artwork|poster|banner|logo)\s*(of|about|for|showing)?\s*/i, '').trim() || text;
          
          const { filepath, provider } = await imageGen.generateAndSave(prompt);
          const providerLabel = { stability: '⚡ Stability AI', fal: '🚀 fal.ai', pollinations: '🌸 Pollinations' }[provider] || provider;
          await ctx.replyWithPhoto({ source: filepath }, { caption: `🎨 ${prompt}\n\n${providerLabel}` });
        } catch (imgErr) {
          console.error('Image gen error:', imgErr.message);
          await ctx.reply('❌ Could not generate the image. All providers failed.\n\nTry:\n• A simpler or shorter description\n• Trying again in a moment');
        }
        return;
      }

      // Extract clean text
      let response = typeof result.response === 'string' ? result.response : (result.response?.text || result.response?.content || String(result.response || ''));

      // Catch raw JSON leaks
      if (response.startsWith('{') && response.includes('"text"')) {
        try { response = JSON.parse(response).text || response; } catch (e) {}
      }

      // Send clean response (HTML formatted, with fallback)
      try {
        await ctx.replyWithHTML(response, { disable_web_page_preview: true });
      } catch (htmlErr) {
        console.warn('HTML reply failed, falling back to plain text:', htmlErr.message);
        await ctx.reply(response, { disable_web_page_preview: true });
      }
    } catch (err) {
      console.error('Chat error:', err.message);
      await ctx.reply('Something went wrong. Try again.');
    }
  });

  // ── Wizard Callback Query Actions ──
  bot.action(/^wizard_task_prio_(.+)$/, (ctx) => {
    const priority = ctx.match[1];
    ctx.answerCbQuery(`Priority set to ${priority}`);
    if (ctx.session?.wizard?.active && ctx.session.wizard.type === 'add_task') {
      const wizards = require('./commands/wizards');
      return wizards.saveTaskAndReply(ctx, ctx.session.wizard.data.title, priority);
    }
    return ctx.reply('Session expired or cancelled. Please try again.');
  });

  bot.action(/^wizard_content_plat_(.+)$/, (ctx) => {
    const platform = ctx.match[1];
    ctx.answerCbQuery(`Platform set to ${platform}`);
    if (ctx.session?.wizard?.active && ctx.session.wizard.type === 'create_content') {
      const wizards = require('./commands/wizards');
      return wizards.saveContentAndReply(ctx, ctx.session.wizard.data.topic, platform);
    }
    return ctx.reply('Session expired or cancelled. Please try again.');
  });

  // ── Callback query router (inline keyboard actions) ──
  // Each command module registers its own actions, but we add a fallback:
  bot.on('callback_query', (ctx) => {
    ctx.answerCbQuery('Action not recognised').catch(() => {});
  });

  // ── Launch with polling ──
  bot.launch({ dropPendingUpdates: true }).catch(err => {
    console.error('⚠️  Failed to start Telegram bot:', err.message);
    if (err.message.includes('Conflict')) {
      console.error('👉 Conflict error: Another instance of this bot is already running elsewhere (e.g. on a VPS, phone, or another machine).');
    }
  });
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
