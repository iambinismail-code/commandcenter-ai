// Central Wizards Module — Step-by-step interactive inputs
const { Markup } = require('telegraf');
const db = require('../../server/config/database');

/**
 * Handle wizard step logic
 */
async function handleWizardStep(ctx, text) {
  ctx.session = ctx.session || {};
  const wizard = ctx.session.wizard;
  if (!wizard || !wizard.active) return;

  const type = wizard.type;

  switch (type) {
    case 'add_contact':
      return handleAddContact(ctx, text);
    case 'add_lead':
      return handleAddLead(ctx, text);
    case 'add_task':
      return handleAddTask(ctx, text);
    case 'create_content':
      return handleCreateContent(ctx, text);
    case 'ask_agent':
      return handleAskAgent(ctx, text);
    default:
      ctx.session.wizard = null;
  }
}

// ── Contact Wizard ──
async function handleAddContact(ctx, text) {
  const wizard = ctx.session.wizard;

  if (wizard.step === 'name') {
    wizard.data.name = text;
    wizard.step = 'phone';
    return ctx.replyWithHTML(
      `Okay, the contact's name is <b>${text}</b>.\n\n` +
      `📞 What is their phone number? (Or type /skip if none)`
    );
  }

  if (wizard.step === 'phone') {
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

// ── Lead Wizard ──
async function handleAddLead(ctx, text) {
  const wizard = ctx.session.wizard;

  if (wizard.step === 'title') {
    wizard.data.title = text;
    wizard.step = 'value';
    return ctx.replyWithHTML(
      `Okay, lead title is <b>${text}</b>.\n\n` +
      `💰 What is the estimated deal value in BDT? (Or type /skip if none)`
    );
  }

  if (wizard.step === 'value') {
    let value = 0;
    if (text.toLowerCase() !== '/skip') {
      const parsed = parseFloat(text.replace(/,/g, ''));
      if (!isNaN(parsed)) {
        value = parsed;
      }
    }

    try {
      const result = db.prepare(
        'INSERT INTO leads (title, value, stage, source) VALUES (?, ?, ?, ?)'
      ).run(wizard.data.title, value, 'new', 'telegram');

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('📋 Lead Pipeline', 'action_pipeline'),
          Markup.button.callback('🔙 Back to CRM', 'menu_crm'),
        ],
      ]);

      ctx.session.wizard = null;

      return ctx.replyWithHTML(
        `✅ <b>Lead Created Successfully!</b>\n\n` +
        `🎯 Title: <b>${wizard.data.title}</b>\n` +
        `💰 Value: ৳${value.toLocaleString()}\n` +
        `📌 Stage: new\n` +
        `🆔 ID: #${result.lastInsertRowid}`,
        keyboard
      );
    } catch (err) {
      console.error('Wizard DB error:', err.message);
      ctx.session.wizard = null;
      return ctx.reply('⚠️ Failed to save lead. Try again later.');
    }
  }
}

// ── Task Wizard ──
async function handleAddTask(ctx, text) {
  const wizard = ctx.session.wizard;

  if (wizard.step === 'title') {
    wizard.data.title = text;
    wizard.step = 'priority';

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('🔴 Urgent', 'wizard_task_prio_urgent'),
        Markup.button.callback('🟡 High', 'wizard_task_prio_high'),
      ],
      [
        Markup.button.callback('🔵 Medium', 'wizard_task_prio_medium'),
        Markup.button.callback('⚪ Low', 'wizard_task_prio_low'),
      ]
    ]);

    return ctx.replyWithHTML(
      `Okay, task title is <b>${text}</b>.\n\n` +
      `🔘 Select priority below (or type it: low, medium, high, urgent):`,
      keyboard
    );
  }

  if (wizard.step === 'priority') {
    let priority = text.toLowerCase().trim();
    if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
      priority = 'medium';
    }

    return saveTaskAndReply(ctx, wizard.data.title, priority);
  }
}

async function saveTaskAndReply(ctx, title, priority) {
  try {
    const result = db.prepare(
      'INSERT INTO tasks (title, status, priority, assigned_to) VALUES (?, ?, ?, ?)'
    ).run(title, 'todo', priority, 'user');

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Done', `task_done_${result.lastInsertRowid}`),
        Markup.button.callback('📋 View Tasks', 'task_list_all'),
      ],
    ]);

    ctx.session.wizard = null;

    const prioEmoji = { urgent: '🔴', high: '🟡', medium: '🔵', low: '⚪' };
    return ctx.replyWithHTML(
      `✅ <b>Task Created Successfully!</b>\n\n` +
      `📌 Title: <b>${title}</b>\n` +
      `🔘 Priority: ${prioEmoji[priority]} ${priority}\n` +
      `🆔 ID: #${result.lastInsertRowid}`,
      keyboard
    );
  } catch (err) {
    console.error('Wizard DB error:', err.message);
    ctx.session.wizard = null;
    return ctx.reply('⚠️ Failed to save task. Try again later.');
  }
}

// ── Content Wizard ──
async function handleCreateContent(ctx, text) {
  const wizard = ctx.session.wizard;

  if (wizard.step === 'topic') {
    wizard.data.topic = text;
    wizard.step = 'platform';

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('📘 Facebook', 'wizard_content_plat_facebook'),
        Markup.button.callback('📸 Instagram', 'wizard_content_plat_instagram'),
      ],
      [
        Markup.button.callback('🌐 All Platforms', 'wizard_content_plat_all'),
      ]
    ]);

    return ctx.replyWithHTML(
      `Okay, topic is <b>${text}</b>.\n\n` +
      `📱 Select platform below:`,
      keyboard
    );
  }

  if (wizard.step === 'platform') {
    let platform = text.toLowerCase().trim();
    if (!['facebook', 'instagram', 'all'].includes(platform)) {
      platform = 'facebook';
    }

    return saveContentAndReply(ctx, wizard.data.topic, platform);
  }
}

async function saveContentAndReply(ctx, topic, platform) {
  try {
    const draftBody = `[AI Draft Pending]\n\nTopic: ${topic}\n\nThis content will be generated by the AI Content Creator agent. Use /agent ask to generate content.`;

    const result = db.prepare(
      'INSERT INTO content (title, body, type, platform, status, created_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(topic, draftBody, 'post', platform, 'draft', 'telegram');

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('📋 View Content', 'content_list_all'),
        Markup.button.callback('📅 Schedule', `content_sched_prompt_${result.lastInsertRowid}`),
      ],
      [
        Markup.button.callback('🚀 Publish Now', `content_pub_${result.lastInsertRowid}`),
      ],
    ]);

    ctx.session.wizard = null;

    return ctx.replyWithHTML(
      `✅ <b>Content Draft Created!</b>\n\n` +
      `📝 Topic: <b>${topic}</b>\n` +
      `📱 Platform: ${platform}\n` +
      `📌 Status: draft\n` +
      `🆔 ID: #${result.lastInsertRowid}\n\n` +
      `<i>The AI Content Creator will generate the full post body.</i>`,
      keyboard
    );
  } catch (err) {
    console.error('Wizard DB error:', err.message);
    ctx.session.wizard = null;
    return ctx.reply('⚠️ Failed to save draft. Try again later.');
  }
}

// ── Agent Ask Wizard ──
async function handleAskAgent(ctx, text) {
  ctx.session.wizard = null; // Clear immediately to prevent multiple runs
  await ctx.replyWithHTML('🤖 <i>Thinking…</i>');

  try {
    const orchestrator = require('../agents/orchestrator');
    const result = await orchestrator.processCommand(text, {
      userId: ctx.from.id,
      userName: ctx.from.first_name,
      source: 'telegram',
    });

    let response = typeof result.response === 'string' ? result.response : (result.response?.text || result.response?.content || String(result.response || ''));
    if (response.startsWith('{') && response.includes('"text"')) {
      try { response = JSON.parse(response).text || response; } catch (e) {}
    }

    return ctx.reply(response, { disable_web_page_preview: true });
  } catch (err) {
    console.error('Wizard agent ask error:', err.message);
    return ctx.reply('⚠️ Failed to process question.');
  }
}

module.exports = {
  handleWizardStep,
  saveTaskAndReply,
  saveContentAndReply
};
