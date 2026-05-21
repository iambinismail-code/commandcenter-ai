// /task — Task management commands
const { Markup } = require('telegraf');
const db = require('../../server/config/database');
const { PRIORITIES } = require('../../server/config/constants');

module.exports = function (bot) {
  bot.command('task', (ctx) => {
    const text = ctx.message.text.trim();
    const args = text.split(/\s+/).slice(1);
    const subcommand = (args[0] || 'list').toLowerCase();

    switch (subcommand) {
      case 'add':
        return taskAdd(ctx, args.slice(1).join(' '));
      case 'list':
        return taskList(ctx);
      case 'done':
        return taskDone(ctx, args[1]);
      case 'priority':
        return taskPriority(ctx, args[1], args[2]);
      default:
        return ctx.replyWithHTML(
          '✅ <b>Task Commands</b>\n\n' +
          '<code>/task add &lt;title&gt;</code> — Add task\n' +
          '<code>/task list</code> — Pending tasks\n' +
          '<code>/task done &lt;id&gt;</code> — Mark done\n' +
          '<code>/task priority &lt;id&gt; &lt;level&gt;</code> — Set priority'
        );
    }
  });

  // ── Add task ──
  async function taskAdd(ctx, title) {
    if (!title) {
      return ctx.replyWithHTML('Usage: <code>/task add &lt;title&gt;</code>');
    }

    try {
      const result = db.prepare(
        'INSERT INTO tasks (title, status, priority, assigned_to) VALUES (?, ?, ?, ?)'
      ).run(title, 'todo', 'medium', 'user');

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Done', `task_done_${result.lastInsertRowid}`),
          Markup.button.callback('🔴 Urgent', `task_prio_${result.lastInsertRowid}_urgent`),
          Markup.button.callback('🟡 High', `task_prio_${result.lastInsertRowid}_high`),
        ],
        [
          Markup.button.callback('📋 All Tasks', 'task_list_all'),
        ],
      ]);

      return ctx.replyWithHTML(
        `✅ <b>Task Added!</b>\n\n` +
        `📌 <b>${title}</b>\n` +
        `🔘 Priority: medium\n` +
        `📊 Status: todo\n` +
        `🆔 ID: #${result.lastInsertRowid}`,
        keyboard
      );
    } catch (err) {
      console.error('Task add error:', err.message);
      return ctx.replyWithHTML('⚠️ Failed to add task.');
    }
  }

  // ── List pending tasks ──
  async function taskList(ctx) {
    try {
      const tasks = db.prepare(
        "SELECT id, title, priority, status, due_date, category FROM tasks WHERE status != 'done' ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END, created_at DESC LIMIT 20"
      ).all();

      if (tasks.length === 0) {
        return ctx.replyWithHTML(
          '✅ <b>Tasks</b>\n\nNo pending tasks! 🎉\n<code>/task add Buy groceries</code>'
        );
      }

      const prioEmoji = {
        urgent: '🔴', high: '🟡', medium: '🔵', low: '⚪',
      };
      const statusEmoji = {
        todo: '⬜', in_progress: '🔄', review: '👁', done: '✅',
      };

      let msg = '✅ <b>Pending Tasks</b>\n━━━━━━━━━━━━━━━━━━━\n\n';
      tasks.forEach((t) => {
        const prio = prioEmoji[t.priority] || '🔵';
        const status = statusEmoji[t.status] || '⬜';
        const due = t.due_date ? ` 📅 ${t.due_date}` : '';
        msg += `${status} ${prio} <b>#${t.id}</b> ${t.title}${due}\n`;
      });

      msg += `\n<i>${tasks.length} pending task(s)</i>`;

      // Action buttons for first 5
      const buttons = tasks.slice(0, 5).map((t) => [
        Markup.button.callback(`✅ Done #${t.id}`, `task_done_${t.id}`),
        Markup.button.callback(`📌 ${t.title.substring(0, 15)}`, `task_view_${t.id}`),
      ]);

      return ctx.replyWithHTML(msg, Markup.inlineKeyboard(buttons));
    } catch (err) {
      console.error('Task list error:', err.message);
      return ctx.replyWithHTML('⚠️ Failed to load tasks.');
    }
  }

  // ── Mark task done ──
  async function taskDone(ctx, id) {
    if (!id) {
      return ctx.replyWithHTML('Usage: <code>/task done &lt;id&gt;</code>');
    }

    try {
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
      if (!task) return ctx.replyWithHTML(`❌ Task #${id} not found.`);

      db.prepare(
        'UPDATE tasks SET status = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run('done', id);

      return ctx.replyWithHTML(
        `✅ <b>Task Completed!</b>\n\n` +
        `🎉 <s>${task.title}</s>\n\n` +
        `<i>Great job! One less thing to worry about.</i>`
      );
    } catch (err) {
      console.error('Task done error:', err.message);
      return ctx.replyWithHTML('⚠️ Failed to update task.');
    }
  }

  // ── Change task priority ──
  async function taskPriority(ctx, id, priority) {
    if (!id || !priority) {
      return ctx.replyWithHTML(
        `Usage: <code>/task priority &lt;id&gt; &lt;level&gt;</code>\n\nLevels: ${PRIORITIES.join(', ')}`
      );
    }

    if (!PRIORITIES.includes(priority.toLowerCase())) {
      return ctx.replyWithHTML(
        `❌ Invalid priority. Valid: ${PRIORITIES.join(', ')}`
      );
    }

    try {
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
      if (!task) return ctx.replyWithHTML(`❌ Task #${id} not found.`);

      db.prepare(
        'UPDATE tasks SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(priority.toLowerCase(), id);

      const prioEmoji = { urgent: '🔴', high: '🟡', medium: '🔵', low: '⚪' };
      return ctx.replyWithHTML(
        `${prioEmoji[priority.toLowerCase()] || '📌'} <b>Priority Updated!</b>\n\n` +
        `📌 <b>${task.title}</b>\n` +
        `${task.priority} → <b>${priority.toLowerCase()}</b>`
      );
    } catch (err) {
      console.error('Task priority error:', err.message);
      return ctx.replyWithHTML('⚠️ Failed to update priority.');
    }
  }

  // ── Callback: Mark done from button ──
  bot.action(/^task_done_(\d+)$/, (ctx) => {
    const id = ctx.match[1];
    ctx.answerCbQuery('Marking as done…');
    try {
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
      if (!task) return ctx.replyWithHTML(`❌ Task #${id} not found.`);

      db.prepare(
        'UPDATE tasks SET status = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run('done', id);

      return ctx.replyWithHTML(`✅ Task "<b>${task.title}</b>" completed! 🎉`);
    } catch (err) {
      return ctx.replyWithHTML('⚠️ Failed to complete task.');
    }
  });

  // ── Callback: Set priority from button ──
  bot.action(/^task_prio_(\d+)_(\w+)$/, (ctx) => {
    const id = ctx.match[1];
    const priority = ctx.match[2];
    ctx.answerCbQuery(`Setting to ${priority}…`);
    try {
      db.prepare(
        'UPDATE tasks SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(priority, id);

      return ctx.replyWithHTML(`📌 Task #${id} priority set to <b>${priority}</b>.`);
    } catch (err) {
      return ctx.replyWithHTML('⚠️ Failed to update priority.');
    }
  });

  // ── Callback: View task detail ──
  bot.action(/^task_view_(\d+)$/, (ctx) => {
    const id = ctx.match[1];
    ctx.answerCbQuery();
    try {
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
      if (!task) return ctx.replyWithHTML('❌ Task not found.');

      const prioEmoji = { urgent: '🔴', high: '🟡', medium: '🔵', low: '⚪' };

      const msg = [
        `✅ <b>Task #${task.id}</b>`,
        `━━━━━━━━━━━━━━━━━━━`,
        `📌 <b>Title:</b> ${task.title}`,
        task.description ? `📝 <b>Description:</b> ${task.description}` : null,
        `${prioEmoji[task.priority] || '📌'} <b>Priority:</b> ${task.priority}`,
        `📊 <b>Status:</b> ${task.status}`,
        `📁 <b>Category:</b> ${task.category}`,
        task.due_date ? `📅 <b>Due:</b> ${task.due_date}` : null,
        `📅 <b>Created:</b> ${task.created_at}`,
      ].filter(Boolean).join('\n');

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Done', `task_done_${task.id}`),
          Markup.button.callback('🔴 Urgent', `task_prio_${task.id}_urgent`),
        ],
      ]);

      return ctx.replyWithHTML(msg, keyboard);
    } catch (err) {
      return ctx.replyWithHTML('⚠️ Failed to load task.');
    }
  });

  // ── Callback: Refresh list ──
  bot.action('task_list_all', (ctx) => {
    ctx.answerCbQuery();
    return taskList(ctx);
  });
};
