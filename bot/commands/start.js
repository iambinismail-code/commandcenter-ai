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

    const keyboard = Markup.keyboard([
      ['📇 CRM Contacts', '✅ My Tasks'],
      ['📝 Content Ideas', '🤖 Agent Status'],
      ['📊 Daily Report', '⚙️ Help']
    ]).resize(); // Makes the buttons smaller and sticky at the bottom

    return ctx.replyWithHTML(welcome, keyboard);
  });
};
