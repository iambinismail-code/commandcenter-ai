// /social — Social media management commands (Facebook placeholder)
const { Markup } = require('telegraf');
const config = require('../../server/config/env');
const db = require('../../server/config/database');

module.exports = function (bot) {
  bot.command('social', (ctx) => {
    const text = ctx.message.text.trim();
    const args = text.split(/\s+/).slice(1);
    const subcommand = (args[0] || 'pages').toLowerCase();

    switch (subcommand) {
      case 'post':
        return socialPost(ctx, args.slice(1).join(' '));
      case 'stats':
        return socialStats(ctx);
      case 'pages':
        return socialPages(ctx);
      default:
        return ctx.replyWithHTML(
          '📱 <b>Social Media Commands</b>\n\n' +
          '<code>/social post &lt;message&gt;</code> — Quick post to FB\n' +
          '<code>/social stats</code> — Page statistics\n' +
          '<code>/social pages</code> — Managed pages'
        );
    }
  });

  // ── Quick post to Facebook (placeholder) ──
  async function socialPost(ctx, message) {
    if (!message) {
      return ctx.replyWithHTML('Usage: <code>/social post &lt;message&gt;</code>');
    }

    const fbConfigured = !!(config.facebook.pageAccessToken && config.facebook.pageId);

    if (!fbConfigured) {
      // Save as draft content instead
      try {
        const result = db.prepare(
          'INSERT INTO content (title, body, type, platform, status, created_by) VALUES (?, ?, ?, ?, ?, ?)'
        ).run('Quick Post', message, 'post', 'facebook', 'draft', 'telegram');

        return ctx.replyWithHTML(
          `📱 <b>Facebook Not Configured</b>\n\n` +
          `Your post has been saved as a draft (#${result.lastInsertRowid}).\n\n` +
          `<i>Configure FB_PAGE_ACCESS_TOKEN and FB_PAGE_ID in .env to enable direct posting.</i>\n\n` +
          `Draft saved:\n<code>${message.substring(0, 200)}</code>`
        );
      } catch (err) {
        return ctx.replyWithHTML('⚠️ Failed to save post draft.');
      }
    }

    // Placeholder: In production, this would call the Facebook Graph API
    try {
      const result = db.prepare(
        'INSERT INTO content (title, body, type, platform, status, created_by, published_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
      ).run('Quick Post', message, 'post', 'facebook', 'published', 'telegram');

      return ctx.replyWithHTML(
        `🚀 <b>Post Queued for Facebook!</b>\n\n` +
        `📝 <code>${message.substring(0, 300)}</code>\n\n` +
        `📱 Page: ${config.facebook.pageId}\n` +
        `🆔 Content ID: #${result.lastInsertRowid}\n\n` +
        `<i>Note: The Social Media agent will publish this post via the Graph API.</i>`
      );
    } catch (err) {
      console.error('Social post error:', err.message);
      return ctx.replyWithHTML('⚠️ Failed to create post.');
    }
  }

  // ── Page statistics (placeholder) ──
  async function socialStats(ctx) {
    const fbConfigured = !!(config.facebook.pageAccessToken && config.facebook.pageId);

    // Show content stats from our DB as a proxy
    try {
      const published = db.prepare(
        "SELECT COUNT(*) as cnt FROM content WHERE status = 'published' AND platform = 'facebook'"
      ).get();
      const scheduled = db.prepare(
        "SELECT COUNT(*) as cnt FROM content WHERE status = 'scheduled' AND platform = 'facebook'"
      ).get();
      const drafts = db.prepare(
        "SELECT COUNT(*) as cnt FROM content WHERE status = 'draft' AND platform = 'facebook'"
      ).get();

      let msg = '📊 <b>Social Media Stats</b>\n━━━━━━━━━━━━━━━━━━━\n\n';

      msg += `📱 <b>Facebook Page</b>\n`;
      msg += `   Page ID: ${config.facebook.pageId || '❌ Not configured'}\n`;
      msg += `   API Status: ${fbConfigured ? '✅ Connected' : '❌ Not connected'}\n\n`;

      msg += `📝 <b>Content Stats</b>\n`;
      msg += `   ✅ Published: ${published.cnt}\n`;
      msg += `   📅 Scheduled: ${scheduled.cnt}\n`;
      msg += `   📝 Drafts: ${drafts.cnt}\n\n`;

      if (!fbConfigured) {
        msg += `<i>💡 Configure Facebook credentials in .env for live engagement stats (likes, comments, shares, reach).</i>`;
      } else {
        msg += `<i>💡 Live engagement metrics will be available once the Social Media agent fetches data from the Graph API.</i>`;
      }

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📝 View Content', 'content_list_all')],
      ]);

      return ctx.replyWithHTML(msg, keyboard);
    } catch (err) {
      console.error('Social stats error:', err.message);
      return ctx.replyWithHTML('⚠️ Failed to load stats.');
    }
  }

  // ── List managed pages ──
  async function socialPages(ctx) {
    const fbConfigured = !!(config.facebook.pageAccessToken && config.facebook.pageId);

    let msg = '📱 <b>Managed Pages</b>\n━━━━━━━━━━━━━━━━━━━\n\n';

    if (fbConfigured) {
      msg += `✅ <b>Facebook Page</b>\n`;
      msg += `   Page ID: <code>${config.facebook.pageId}</code>\n`;
      msg += `   API Version: ${config.facebook.graphApiVersion}\n`;
      msg += `   Token: ✅ Configured\n\n`;
    } else {
      msg += `❌ <b>No pages connected</b>\n\n`;
      msg += `To connect your Facebook page:\n`;
      msg += `1. Create an app at developers.facebook.com\n`;
      msg += `2. Get a Page Access Token\n`;
      msg += `3. Add to your .env file:\n`;
      msg += `   <code>FB_PAGE_ACCESS_TOKEN=your_token</code>\n`;
      msg += `   <code>FB_PAGE_ID=your_page_id</code>\n`;
    }

    return ctx.replyWithHTML(msg);
  }
};
