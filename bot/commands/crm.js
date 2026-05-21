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
      case 'list':
        return crmList(ctx);
      case 'add':
        return crmAdd(ctx, args.slice(1));
      case 'search':
        return crmSearch(ctx, args.slice(1).join(' '));
      case 'stats':
        return crmStats(ctx);
      default:
        return ctx.replyWithHTML(
          '📇 <b>CRM Commands</b>\n\n' +
          '<code>/crm list</code> — Recent contacts\n' +
          '<code>/crm add &lt;name&gt; &lt;phone&gt;</code> — Add contact\n' +
          '<code>/crm search &lt;query&gt;</code> — Search\n' +
          '<code>/crm stats</code> — Summary'
        );
    }
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
