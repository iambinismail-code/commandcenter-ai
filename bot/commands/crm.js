// /crm — Contact management commands
const { Markup } = require('telegraf');
const db = require('../../server/config/database');

module.exports = function (bot) {
  // ── /crm (default = list) ──
  bot.command('crm', (ctx) => {
    const text = ctx.message.text.trim();
    const args = text.split(/\s+/).slice(1); // remove '/crm'
    const subcommand = (args[0] || 'list').toLowerCase();

    switch (subcommand) {
      case 'menu':
      case 'list': // We'll map the persistent button to /crm menu instead of list
        return crmMenu(ctx);
      case 'add':
        return crmAdd(ctx, args.slice(1));
      case 'search':
        return crmSearch(ctx, args.slice(1).join(' '));
      case 'stats':
        return crmStats(ctx);
      default:
        return crmMenu(ctx);
    }
  });

  bot.hears('📇 CRM Contacts', (ctx) => {
    return crmMenu(ctx);
  });

  bot.action('menu_crm', (ctx) => {
    ctx.answerCbQuery();
    return crmMenu(ctx);
  });

  bot.action('action_add_contact', (ctx) => {
    ctx.answerCbQuery();
    ctx.session = ctx.session || {};
    ctx.session.wizard = { active: true, type: 'add_contact', step: 'name', data: {} };
    return ctx.replyWithHTML('📇 <b>Add New Contact</b>\n\nWhat is the contact\'s full name? (Type /cancel to abort)');
  });

  bot.action('action_add_lead', (ctx) => {
    ctx.answerCbQuery();
    ctx.session = ctx.session || {};
    ctx.session.wizard = { active: true, type: 'add_lead', step: 'title', data: {} };
    return ctx.replyWithHTML('🎯 <b>Add New Lead</b>\n\nWhat is the lead\'s title or description? (Type /cancel to abort)');
  });

  bot.action('action_pipeline', (ctx) => {
    ctx.answerCbQuery();
    try {
      const { LEAD_STAGES } = require('../../server/config/constants');
      const leads = db.prepare(
        'SELECT id, title, stage, priority, value FROM leads ORDER BY stage, created_at DESC'
      ).all();

      if (leads.length === 0) {
        return ctx.replyWithHTML(
          '🎯 <b>Leads</b>\n\nNo leads yet.\nUse the menu to add a lead!'
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
  });

  // ── CRM Menu ──
  async function crmMenu(ctx) {
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('👥 List Contacts', 'action_list_contacts'),
        Markup.button.callback('➕ Add Contact', 'action_add_contact'),
      ],
      [
        Markup.button.callback('📋 Lead Pipeline', 'action_pipeline'),
        Markup.button.callback('➕ Add Lead', 'action_add_lead'),
      ],
      [
        Markup.button.callback('📊 CRM Stats', 'action_crm_stats'),
      ]
    ]);

    return ctx.replyWithHTML('📇 <b>CRM Dashboard</b>\n\nChoose an action below:', keyboard);
  }

  // ── Callbacks for Menu Actions ──
  bot.action('action_list_contacts', (ctx) => {
    ctx.answerCbQuery();
    return crmList(ctx);
  });

  bot.action('action_crm_stats', (ctx) => {
    ctx.answerCbQuery();
    return crmStats(ctx);
  });

  // ── List recent contacts ──
  async function crmList(ctx) {
    try {
      const contacts = db.prepare(
        'SELECT id, name, phone, email, source, status FROM contacts ORDER BY created_at DESC LIMIT 15'
      ).all();

      if (contacts.length === 0) {
        return ctx.replyWithHTML(
          '📇 <b>Contacts</b>\n\nNo contacts yet. Add one with:\n<code>/crm add John Doe 01712345678</code>'
        );
      }

      let msg = '📇 <b>Recent Contacts</b>\n━━━━━━━━━━━━━━━━━━━\n\n';
      contacts.forEach((c, i) => {
        const phone = c.phone ? ` 📞 ${c.phone}` : '';
        const src = c.source ? ` [${c.source}]` : '';
        msg += `<b>${i + 1}.</b> ${c.name}${phone}${src}\n`;
      });
      msg += `\n<i>Total: ${contacts.length} shown</i>`;

      // Build inline keyboards for top 5 contacts
      const buttons = contacts.slice(0, 5).map((c) => [
        Markup.button.callback(`👁 ${c.name}`, `crm_view_${c.id}`),
        Markup.button.callback('🗑', `crm_del_${c.id}`),
      ]);

      return ctx.replyWithHTML(msg, Markup.inlineKeyboard(buttons));
    } catch (err) {
      console.error('CRM list error:', err.message);
      return ctx.replyWithHTML('⚠️ Failed to load contacts.');
    }
  }

  // ── Add a contact ──
  async function crmAdd(ctx, args) {
    if (args.length < 2) {
      return ctx.replyWithHTML(
        '📇 <b>Add Contact</b>\n\n' +
        'Usage: <code>/crm add &lt;name&gt; &lt;phone&gt;</code>\n' +
        'Example: <code>/crm add John Doe 01712345678</code>'
      );
    }

    // Last arg is phone, everything else is name
    const phone = args[args.length - 1];
    const name = args.slice(0, -1).join(' ');

    try {
      const result = db.prepare(
        'INSERT INTO contacts (name, phone, source) VALUES (?, ?, ?)'
      ).run(name, phone, 'telegram');

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('👁 View', `crm_view_${result.lastInsertRowid}`),
          Markup.button.callback('📇 All Contacts', 'crm_list_all'),
        ],
      ]);

      return ctx.replyWithHTML(
        `✅ <b>Contact Added!</b>\n\n` +
        `👤 Name: <b>${name}</b>\n` +
        `📞 Phone: ${phone}\n` +
        `📥 Source: telegram\n` +
        `🆔 ID: #${result.lastInsertRowid}`,
        keyboard
      );
    } catch (err) {
      console.error('CRM add error:', err.message);
      return ctx.replyWithHTML('⚠️ Failed to add contact. Please try again.');
    }
  }

  // ── Search contacts ──
  async function crmSearch(ctx, query) {
    if (!query) {
      return ctx.replyWithHTML('Usage: <code>/crm search &lt;query&gt;</code>');
    }

    try {
      const pattern = `%${query}%`;
      const results = db.prepare(
        'SELECT id, name, phone, email, source FROM contacts WHERE name LIKE ? OR email LIKE ? OR phone LIKE ? LIMIT 10'
      ).all(pattern, pattern, pattern);

      if (results.length === 0) {
        return ctx.replyWithHTML(`🔍 No contacts found for "<b>${query}</b>".`);
      }

      let msg = `🔍 <b>Search Results for "${query}"</b>\n\n`;
      results.forEach((c, i) => {
        const phone = c.phone ? ` — ${c.phone}` : '';
        const email = c.email ? ` — ${c.email}` : '';
        msg += `<b>${i + 1}.</b> ${c.name}${phone}${email}\n`;
      });

      const buttons = results.slice(0, 5).map((c) => [
        Markup.button.callback(`👁 ${c.name}`, `crm_view_${c.id}`),
      ]);

      return ctx.replyWithHTML(msg, Markup.inlineKeyboard(buttons));
    } catch (err) {
      console.error('CRM search error:', err.message);
      return ctx.replyWithHTML('⚠️ Search failed.');
    }
  }

  // ── CRM stats ──
  async function crmStats(ctx) {
    try {
      const total = db.prepare('SELECT COUNT(*) as cnt FROM contacts').get();
      const bySource = db.prepare(
        'SELECT source, COUNT(*) as cnt FROM contacts GROUP BY source ORDER BY cnt DESC'
      ).all();
      const byStatus = db.prepare(
        'SELECT status, COUNT(*) as cnt FROM contacts GROUP BY status ORDER BY cnt DESC'
      ).all();
      const leadCount = db.prepare('SELECT COUNT(*) as cnt FROM leads').get();
      const leadsByStage = db.prepare(
        'SELECT stage, COUNT(*) as cnt FROM leads GROUP BY stage ORDER BY cnt DESC'
      ).all();

      let msg = '📊 <b>CRM Statistics</b>\n━━━━━━━━━━━━━━━━━━━\n\n';
      msg += `📇 <b>Total Contacts:</b> ${total.cnt}\n\n`;

      if (bySource.length) {
        msg += '<b>By Source:</b>\n';
        bySource.forEach((s) => { msg += `  • ${s.source || 'unknown'}: ${s.cnt}\n`; });
        msg += '\n';
      }

      if (byStatus.length) {
        msg += '<b>By Status:</b>\n';
        byStatus.forEach((s) => { msg += `  • ${s.status}: ${s.cnt}\n`; });
        msg += '\n';
      }

      msg += `🎯 <b>Total Leads:</b> ${leadCount.cnt}\n`;
      if (leadsByStage.length) {
        msg += '\n<b>Leads by Stage:</b>\n';
        leadsByStage.forEach((s) => { msg += `  • ${s.stage}: ${s.cnt}\n`; });
      }

      return ctx.replyWithHTML(msg);
    } catch (err) {
      console.error('CRM stats error:', err.message);
      return ctx.replyWithHTML('⚠️ Failed to load stats.');
    }
  }

  // ── Callback: View contact detail ──
  bot.action(/^crm_view_(\d+)$/, (ctx) => {
    const id = ctx.match[1];
    ctx.answerCbQuery();
    try {
      const contact = db.prepare(
        'SELECT * FROM contacts WHERE id = ?'
      ).get(id);

      if (!contact) return ctx.replyWithHTML('❌ Contact not found.');

      const msg = [
        `📇 <b>Contact #${contact.id}</b>`,
        `━━━━━━━━━━━━━━━━━━━`,
        `👤 <b>Name:</b> ${contact.name}`,
        contact.email ? `📧 <b>Email:</b> ${contact.email}` : null,
        contact.phone ? `📞 <b>Phone:</b> ${contact.phone}` : null,
        contact.company ? `🏢 <b>Company:</b> ${contact.company}` : null,
        `📥 <b>Source:</b> ${contact.source}`,
        `📌 <b>Status:</b> ${contact.status}`,
        contact.notes ? `📝 <b>Notes:</b> ${contact.notes}` : null,
        `📅 <b>Added:</b> ${contact.created_at}`,
      ].filter(Boolean).join('\n');

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('🗑 Delete', `crm_del_${contact.id}`),
          Markup.button.callback('📇 All Contacts', 'crm_list_all'),
        ],
      ]);

      return ctx.replyWithHTML(msg, keyboard);
    } catch (err) {
      return ctx.replyWithHTML('⚠️ Failed to load contact.');
    }
  });

  // ── Callback: Delete contact ──
  bot.action(/^crm_del_(\d+)$/, (ctx) => {
    const id = ctx.match[1];
    ctx.answerCbQuery();
    try {
      const contact = db.prepare('SELECT name FROM contacts WHERE id = ?').get(id);
      if (!contact) return ctx.replyWithHTML('❌ Contact not found.');

      db.prepare('DELETE FROM contacts WHERE id = ?').run(id);
      return ctx.replyWithHTML(`🗑 Contact "<b>${contact.name}</b>" deleted.`);
    } catch (err) {
      return ctx.replyWithHTML('⚠️ Failed to delete contact.');
    }
  });

  // ── Callback: Refresh list ──
  bot.action('crm_list_all', (ctx) => {
    ctx.answerCbQuery();
    return crmList(ctx);
  });
};
