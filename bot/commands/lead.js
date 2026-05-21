// /lead — Lead pipeline management commands
const { Markup } = require('telegraf');
const db = require('../../server/config/database');
const { LEAD_STAGES } = require('../../server/config/constants');

module.exports = function (bot) {
  bot.command('lead', (ctx) => {
    const text = ctx.message.text.trim();
    const args = text.split(/\s+/).slice(1);
    const subcommand = (args[0] || 'list').toLowerCase();

    switch (subcommand) {
      case 'list':
        return leadList(ctx);
      case 'new':
        return leadNew(ctx, args.slice(1).join(' '));
      case 'pipeline':
        return leadPipeline(ctx);
      case 'move':
        return leadMove(ctx, args[1], args[2]);
      default:
        return ctx.replyWithHTML(
          '🎯 <b>Lead Commands</b>\n\n' +
          '<code>/lead list</code> — Leads by stage\n' +
          '<code>/lead new &lt;title&gt;</code> — Create lead\n' +
          '<code>/lead pipeline</code> — Pipeline summary\n' +
          '<code>/lead move &lt;id&gt; &lt;stage&gt;</code> — Move lead'
        );
    }
  });

  // ── List leads grouped by stage ──
  async function leadList(ctx) {
    try {
      const leads = db.prepare(
        'SELECT id, title, stage, priority, value FROM leads ORDER BY stage, created_at DESC'
      ).all();

      if (leads.length === 0) {
        return ctx.replyWithHTML(
          '🎯 <b>Leads</b>\n\nNo leads yet.\n<code>/lead new My First Lead</code>'
        );
      }

      const stageEmoji = {
        new: '🆕', contacted: '📞', qualified: '✅',
        proposal: '📋', negotiation: '🤝', won: '🏆', lost: '❌',
      };

      // Group by stage
      const grouped = {};
      leads.forEach((l) => {
        if (!grouped[l.stage]) grouped[l.stage] = [];
        grouped[l.stage].push(l);
      });

      let msg = '🎯 <b>Leads by Stage</b>\n━━━━━━━━━━━━━━━━━━━\n\n';
      for (const stage of LEAD_STAGES) {
        const items = grouped[stage];
        if (!items || items.length === 0) continue;
        const emoji = stageEmoji[stage] || '📌';
        msg += `${emoji} <b>${stage.toUpperCase()}</b> (${items.length})\n`;
        items.forEach((l) => {
          const val = l.value ? ` — ৳${l.value.toLocaleString()}` : '';
          msg += `  #${l.id} ${l.title}${val}\n`;
        });
        msg += '\n';
      }

      return ctx.replyWithHTML(msg);
    } catch (err) {
      console.error('Lead list error:', err.message);
      return ctx.replyWithHTML('⚠️ Failed to load leads.');
    }
  }

  // ── Create a new lead ──
  async function leadNew(ctx, title) {
    if (!title) {
      return ctx.replyWithHTML('Usage: <code>/lead new &lt;title&gt;</code>');
    }

    try {
      const result = db.prepare(
        'INSERT INTO leads (title, stage, source) VALUES (?, ?, ?)'
      ).run(title, 'new', 'telegram');

      const keyboard = Markup.inlineKeyboard(
        LEAD_STAGES.filter(s => s !== 'new').slice(0, 4).map((stage) =>
          Markup.button.callback(stage, `lead_move_${result.lastInsertRowid}_${stage}`)
        )
      );

      return ctx.replyWithHTML(
        `✅ <b>Lead Created!</b>\n\n` +
        `🎯 Title: <b>${title}</b>\n` +
        `📌 Stage: new\n` +
        `🆔 ID: #${result.lastInsertRowid}\n\n` +
        `<i>Move to stage:</i>`,
        keyboard
      );
    } catch (err) {
      console.error('Lead new error:', err.message);
      return ctx.replyWithHTML('⚠️ Failed to create lead.');
    }
  }

  // ── Pipeline summary ──
  async function leadPipeline(ctx) {
    try {
      const stages = db.prepare(
        'SELECT stage, COUNT(*) as cnt, COALESCE(SUM(value), 0) as total_value FROM leads GROUP BY stage'
      ).all();

      const totalLeads = db.prepare('SELECT COUNT(*) as cnt FROM leads').get();
      const totalValue = db.prepare('SELECT COALESCE(SUM(value), 0) as total FROM leads').get();

      const stageEmoji = {
        new: '🆕', contacted: '📞', qualified: '✅',
        proposal: '📋', negotiation: '🤝', won: '🏆', lost: '❌',
      };

      let msg = '🎯 <b>Lead Pipeline</b>\n━━━━━━━━━━━━━━━━━━━\n\n';

      for (const stage of LEAD_STAGES) {
        const data = stages.find(s => s.stage === stage);
        const cnt = data ? data.cnt : 0;
        const val = data ? data.total_value : 0;
        const emoji = stageEmoji[stage] || '📌';
        const bar = '█'.repeat(Math.min(cnt, 10)) + '░'.repeat(Math.max(10 - cnt, 0));
        msg += `${emoji} <b>${stage}</b>\n   ${bar}  ${cnt} leads — ৳${val.toLocaleString()}\n\n`;
      }

      msg += `━━━━━━━━━━━━━━━━━━━\n`;
      msg += `📊 <b>Total:</b> ${totalLeads.cnt} leads — ৳${totalValue.total.toLocaleString()}`;

      return ctx.replyWithHTML(msg);
    } catch (err) {
      console.error('Pipeline error:', err.message);
      return ctx.replyWithHTML('⚠️ Failed to load pipeline.');
    }
  }

  // ── Move lead to new stage ──
  async function leadMove(ctx, id, stage) {
    if (!id || !stage) {
      return ctx.replyWithHTML(
        'Usage: <code>/lead move &lt;id&gt; &lt;stage&gt;</code>\n\n' +
        `Stages: ${LEAD_STAGES.join(', ')}`
      );
    }

    if (!LEAD_STAGES.includes(stage.toLowerCase())) {
      return ctx.replyWithHTML(
        `❌ Invalid stage "<b>${stage}</b>".\n\nValid: ${LEAD_STAGES.join(', ')}`
      );
    }

    try {
      const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
      if (!lead) return ctx.replyWithHTML(`❌ Lead #${id} not found.`);

      const oldStage = lead.stage;
      db.prepare(
        'UPDATE leads SET stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(stage.toLowerCase(), id);

      return ctx.replyWithHTML(
        `✅ <b>Lead Moved!</b>\n\n` +
        `🎯 <b>${lead.title}</b>\n` +
        `📌 ${oldStage} → <b>${stage.toLowerCase()}</b>`
      );
    } catch (err) {
      console.error('Lead move error:', err.message);
      return ctx.replyWithHTML('⚠️ Failed to move lead.');
    }
  }

  // ── Callback: move lead from inline button ──
  bot.action(/^lead_move_(\d+)_(\w+)$/, (ctx) => {
    const id = ctx.match[1];
    const stage = ctx.match[2];
    ctx.answerCbQuery(`Moving to ${stage}…`);

    try {
      const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
      if (!lead) return ctx.replyWithHTML(`❌ Lead #${id} not found.`);

      db.prepare(
        'UPDATE leads SET stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(stage, id);

      return ctx.replyWithHTML(
        `✅ Lead "<b>${lead.title}</b>" moved to <b>${stage}</b>.`
      );
    } catch (err) {
      return ctx.replyWithHTML('⚠️ Failed to move lead.');
    }
  });
};
