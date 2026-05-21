// /start — Welcome message with quick-action inline keyboard
const { Markup } = require('telegraf');

module.exports = function (bot) {
  bot.start((ctx) => {
    const firstName = ctx.from.first_name || 'Boss';

    const welcome = [
      `🚀 <b>Welcome to Bin Group AI, ${firstName}!</b>`,
      '',
      'Your personal AI-powered business assistant:',
      '',
      '📇  <b>CRM</b> — Contacts, leads & deal pipeline',
      '📝  <b>Content</b> — AI-generated posts & scheduling',
      '📱  <b>Social</b> — Facebook page management',
      '✅  <b>Tasks</b> — Personal & business task tracking',
      '🤖  <b>Agents</b> — Multi-agent AI workforce',
      '📊  <b>Reports</b> — Daily & weekly analytics',
      '',
      '💬 <b>Just type any message</b> and I\'ll respond as your AI assistant!',
      'Or tap a button below, or type /help for all commands.',
    ].join('\n');

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('📇 Add Contact', 'quick_add_contact'),
        Markup.button.callback('📝 Create Content', 'quick_create_content'),
      ],
      [
        Markup.button.callback('✅ View Tasks', 'quick_view_tasks'),
        Markup.button.callback('🤖 Agent Status', 'quick_agent_status'),
      ],
      [
        Markup.button.callback('📊 Daily Report', 'quick_daily_report'),
        Markup.button.callback('❓ Help', 'quick_help'),
      ],
    ]);

    return ctx.replyWithHTML(welcome, keyboard);
  });

  // ── Quick-action callbacks ──
  bot.action('quick_add_contact', (ctx) => {
    ctx.answerCbQuery();
    return ctx.replyWithHTML(
      '📇 <b>Quick Add Contact</b>\n\n' +
      'Send a message in this format:\n' +
      '<code>/crm add John Doe 01712345678</code>\n\n' +
      'Or use: <code>/crm add &lt;name&gt; &lt;phone&gt;</code>'
    );
  });

  bot.action('quick_create_content', (ctx) => {
    ctx.answerCbQuery();
    return ctx.replyWithHTML(
      '📝 <b>Create Content</b>\n\n' +
      'Send a message in this format:\n' +
      '<code>/content create Your topic here</code>'
    );
  });

  bot.action('quick_view_tasks', (ctx) => {
    ctx.answerCbQuery();
    // Re-use the task list handler
    ctx.message = { text: '/task list' };
    return ctx.replyWithHTML('Loading tasks…\nUse <code>/task list</code> to see your pending tasks.');
  });

  bot.action('quick_agent_status', (ctx) => {
    ctx.answerCbQuery();
    return ctx.replyWithHTML('Loading agent status…\nUse <code>/agent status</code> to see all agents.');
  });

  bot.action('quick_daily_report', (ctx) => {
    ctx.answerCbQuery();
    return ctx.replyWithHTML('📊 Generating daily report…\nUse <code>/report daily</code>');
  });

  bot.action('quick_help', (ctx) => {
    ctx.answerCbQuery();
    return ctx.replyWithHTML('Type <code>/help</code> to see all available commands.');
  });
};
