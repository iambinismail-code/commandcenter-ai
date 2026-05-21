const { Markup } = require('telegraf');
const db = require('../../server/config/database');

/**
 * Handle step-by-step logic for adding a contact
 */
async function handleAddContactStep(ctx, text) {
  const wizard = ctx.session.wizard;

  if (wizard.step === 'name') {
    // Save name, ask for phone
    wizard.data.name = text;
    wizard.step = 'phone';
    return ctx.replyWithHTML(
      `Okay, the contact's name is <b>${text}</b>.\n\n` +
      `📞 What is their phone number? (Or type /skip if none)`
    );
  }

  if (wizard.step === 'phone') {
    // Save phone, insert to DB
    const phone = text.toLowerCase() === '/skip' ? null : text;
    
    try {
      const result = db.prepare(
        'INSERT INTO contacts (name, phone, source) VALUES (?, ?, ?)'
      ).run(wizard.data.name, phone, 'telegram');

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('👁 View Contact', `crm_view_${result.lastInsertRowid}`),
          Markup.button.callback('🔙 Back to CRM', 'menu_crm'),
        ],
      ]);

      // Clear wizard
      ctx.session.wizard = null;

      return ctx.replyWithHTML(
        `✅ <b>Contact Added Successfully!</b>\n\n` +
        `👤 Name: <b>${wizard.data.name}</b>\n` +
        `📞 Phone: ${phone || 'N/A'}\n` +
        `🆔 ID: #${result.lastInsertRowid}`,
        keyboard
      );
    } catch (err) {
      console.error('Wizard DB error:', err.message);
      ctx.session.wizard = null;
      return ctx.reply('⚠️ Failed to save contact to the database. Try again later.');
    }
  }
}

module.exports = {
  handleAddContactStep
};
