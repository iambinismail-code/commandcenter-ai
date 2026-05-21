// /agent — AI agent management commands
const { Markup } = require('telegraf');
const db = require('../../server/config/database');
const { AGENTS } = require('../../server/config/constants');

module.exports = function (bot) {
  bot.command('agent', (ctx) => {
    const text = ctx.message.text.trim();
    const args = text.split(/\s+/).slice(1);
    const subcommand = (args[0] || 'status').toLowerCase();

    switch (subcommand) {
      case 'status':
        return agentStatus(ctx);
      case 'ask':
        return agentAsk(ctx, args.slice(1).join(' '));
      case 'logs':
        return agentLogs(ctx);
      default:
        return ctx.replyWithHTML(
          '🤖 <b>Agent Commands</b>\n\n' +
          '<code>/agent status</code> — All agent statuses\n' +
          '<code>/agent ask &lt;question&gt;</code> — Ask the AI\n' +
          '<code>/agent logs</code> — Recent activity'
        );
    }
  });

  // ── Agent status ──
  async function agentStatus(ctx) {
    const agentEmoji = {
      orchestrator: '🧠',
      content_creator: '📝',
      social_media: '📱',
      customer_support: '💬',
      analytics: '📊',
      task_manager: '✅',
    };

    try {
      // Get last activity for each agent
      const lastActivity = db.prepare(`
        SELECT agent_name, 
               MAX(created_at) as last_active,
               COUNT(*) as total_actions,
               SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
        FROM agent_logs 
        GROUP BY agent_name
      `).all();

      const activityMap = {};
      lastActivity.forEach((a) => { activityMap[a.agent_name] = a; });

      let msg = '🤖 <b>Agent Status Dashboard</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\n';

      Object.entries(AGENTS).forEach(([key, name]) => {
        const emoji = agentEmoji[name] || '🤖';
        const activity = activityMap[name];

        if (activity) {
          const status = activity.errors > 0 ? '⚠️ Has errors' : '✅ Healthy';
          msg += `${emoji} <b>${name}</b>\n`;
          msg += `   Status: ${status}\n`;
          msg += `   Actions: ${activity.total_actions} | Errors: ${activity.errors}\n`;
          msg += `   Last active: ${activity.last_active}\n\n`;
        } else {
          msg += `${emoji} <b>${name}</b>\n`;
          msg += `   Status: 💤 Idle (no activity yet)\n\n`;
        }
      });

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('📋 View Logs', 'agent_logs_btn'),
          Markup.button.callback('🔄 Refresh', 'agent_refresh'),
        ],
      ]);

      return ctx.replyWithHTML(msg, keyboard);
    } catch (err) {
      console.error('Agent status error:', err.message);
      return ctx.replyWithHTML('⚠️ Failed to load agent status.');
    }
  }

  // ── Ask agent (placeholder — routes to orchestrator) ──
  async function agentAsk(ctx, question) {
    if (!question) {
      return ctx.replyWithHTML('Usage: <code>/agent ask &lt;question&gt;</code>');
    }

    try {
      // Try to load the orchestrator if it exists
      let orchestrator;
      try {
        orchestrator = require('../../agents/orchestrator');
      } catch (e) {
        // Orchestrator not built yet
      }

      if (orchestrator && typeof orchestrator.ask === 'function') {
        await ctx.replyWithHTML('🤖 <i>Thinking…</i>');
        const response = await orchestrator.ask(question);
        return ctx.replyWithHTML(
          `🤖 <b>AI Response</b>\n━━━━━━━━━━━━━━━━━━━\n\n${response}`
        );
      }

      // Log the question for later
      db.prepare(
        'INSERT INTO agent_logs (agent_name, action, input_summary, status) VALUES (?, ?, ?, ?)'
      ).run('orchestrator', 'ask', question, 'pending');

      return ctx.replyWithHTML(
        `🤖 <b>Question Received</b>\n\n` +
        `❓ <i>"${question}"</i>\n\n` +
        `📝 Your question has been logged. The AI orchestrator agent will process it once configured.\n\n` +
        `<i>To enable AI responses, configure GEMINI_API_KEY or GROQ_API_KEY in your .env file.</i>`
      );
    } catch (err) {
      console.error('Agent ask error:', err.message);
      return ctx.replyWithHTML('⚠️ Failed to process question.');
    }
  }

  // ── Recent agent logs ──
  async function agentLogs(ctx) {
    try {
      const logs = db.prepare(
        'SELECT id, agent_name, action, input_summary, status, created_at FROM agent_logs ORDER BY created_at DESC LIMIT 15'
      ).all();

      if (logs.length === 0) {
        return ctx.replyWithHTML(
          '🤖 <b>Agent Logs</b>\n\nNo agent activity recorded yet.'
        );
      }

      const statusEmoji = {
        success: '✅', error: '❌', pending: '⏳', working: '🔄',
      };

      let msg = '🤖 <b>Recent Agent Activity</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\n';
      logs.forEach((log) => {
        const emoji = statusEmoji[log.status] || '📋';
        const summary = log.input_summary
          ? `: ${log.input_summary.substring(0, 40)}${log.input_summary.length > 40 ? '…' : ''}`
          : '';
        msg += `${emoji} <b>${log.agent_name}</b> → ${log.action}${summary}\n`;
        msg += `   <i>${log.created_at}</i>\n\n`;
      });

      return ctx.replyWithHTML(msg);
    } catch (err) {
      console.error('Agent logs error:', err.message);
      return ctx.replyWithHTML('⚠️ Failed to load logs.');
    }
  }

  // ── Callbacks ──
  bot.action('agent_logs_btn', (ctx) => {
    ctx.answerCbQuery();
    return agentLogs(ctx);
  });

  bot.action('agent_refresh', (ctx) => {
    ctx.answerCbQuery('Refreshing…');
    return agentStatus(ctx);
  });
};
