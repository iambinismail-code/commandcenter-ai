// /report — Daily and weekly report generation
const { Markup } = require('telegraf');
const db = require('../../server/config/database');

module.exports = function (bot) {
  bot.command('report', (ctx) => {
    const text = ctx.message.text.trim();
    const args = text.split(/\s+/).slice(1);
    const subcommand = (args[0] || 'daily').toLowerCase();

    switch (subcommand) {
      case 'daily':
        return reportDaily(ctx);
      case 'weekly':
        return reportWeekly(ctx);
      default:
        return ctx.replyWithHTML(
          '📊 <b>Report Commands</b>\n\n' +
          '<code>/report daily</code> — Today\'s summary\n' +
          '<code>/report weekly</code> — This week\'s analytics'
        );
    }
  });

  bot.hears('📊 Daily Report', (ctx) => {
    return reportDaily(ctx);
  });

  bot.action('action_weekly_report', (ctx) => {
    ctx.answerCbQuery('Generating weekly report…');
    return reportWeekly(ctx);
  });

  // ── Daily report ──
  async function reportDaily(ctx) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Contacts added today
      const newContacts = db.prepare(
        "SELECT COUNT(*) as cnt FROM contacts WHERE DATE(created_at) = ?"
      ).get(today);

      // Leads created today
      const newLeads = db.prepare(
        "SELECT COUNT(*) as cnt FROM leads WHERE DATE(created_at) = ?"
      ).get(today);

      // Leads moved today
      const movedLeads = db.prepare(
        "SELECT COUNT(*) as cnt FROM leads WHERE DATE(updated_at) = ? AND DATE(updated_at) != DATE(created_at)"
      ).get(today);

      // Tasks completed today
      const completedTasks = db.prepare(
        "SELECT COUNT(*) as cnt FROM tasks WHERE DATE(completed_at) = ?"
      ).get(today);

      // Tasks created today
      const newTasks = db.prepare(
        "SELECT COUNT(*) as cnt FROM tasks WHERE DATE(created_at) = ?"
      ).get(today);

      // Pending tasks
      const pendingTasks = db.prepare(
        "SELECT COUNT(*) as cnt FROM tasks WHERE status != 'done'"
      ).get();

      // Content published today
      const publishedContent = db.prepare(
        "SELECT COUNT(*) as cnt FROM content WHERE DATE(published_at) = ?"
      ).get(today);

      // Content created today
      const newContent = db.prepare(
        "SELECT COUNT(*) as cnt FROM content WHERE DATE(created_at) = ?"
      ).get(today);

      // Agent actions today
      const agentActions = db.prepare(
        "SELECT COUNT(*) as cnt FROM agent_logs WHERE DATE(created_at) = ?"
      ).get(today);

      // Urgent tasks
      const urgentTasks = db.prepare(
        "SELECT COUNT(*) as cnt FROM tasks WHERE priority = 'urgent' AND status != 'done'"
      ).get();

      const msg = [
        `📊 <b>Daily Report — ${today}</b>`,
        `━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `📇 <b>CRM</b>`,
        `   New contacts: ${newContacts.cnt}`,
        `   New leads: ${newLeads.cnt}`,
        `   Leads progressed: ${movedLeads.cnt}`,
        ``,
        `✅ <b>Tasks</b>`,
        `   Created: ${newTasks.cnt}`,
        `   Completed: ${completedTasks.cnt}`,
        `   Still pending: ${pendingTasks.cnt}`,
        urgentTasks.cnt > 0 ? `   🔴 Urgent: ${urgentTasks.cnt}` : null,
        ``,
        `📝 <b>Content</b>`,
        `   Created: ${newContent.cnt}`,
        `   Published: ${publishedContent.cnt}`,
        ``,
        `🤖 <b>Agents</b>`,
        `   Actions today: ${agentActions.cnt}`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━`,
        completedTasks.cnt > 0
          ? `💪 <i>You completed ${completedTasks.cnt} task(s) today! Keep it up!</i>`
          : `💡 <i>Start your day by checking /task list</i>`,
      ].filter(Boolean).join('\n');

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📊 Generate Weekly Report', 'action_weekly_report')]
      ]);

      return ctx.replyWithHTML(msg, keyboard);
    } catch (err) {
      console.error('Daily report error:', err.message);
      return ctx.replyWithHTML('⚠️ Failed to generate daily report.');
    }
  }

  // ── Weekly report ──
  async function reportWeekly(ctx) {
    try {
      // Calculate date 7 days ago
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const weekAgoStr = weekAgo.toISOString().split('T')[0];
      const todayStr = now.toISOString().split('T')[0];

      // Contacts this week
      const contacts = db.prepare(
        "SELECT COUNT(*) as cnt FROM contacts WHERE DATE(created_at) >= ?"
      ).get(weekAgoStr);

      // Total contacts
      const totalContacts = db.prepare(
        "SELECT COUNT(*) as cnt FROM contacts"
      ).get();

      // Leads this week
      const leads = db.prepare(
        "SELECT COUNT(*) as cnt FROM leads WHERE DATE(created_at) >= ?"
      ).get(weekAgoStr);

      // Leads by stage
      const leadsByStage = db.prepare(
        "SELECT stage, COUNT(*) as cnt FROM leads GROUP BY stage ORDER BY cnt DESC"
      ).all();

      // Won leads this week
      const wonLeads = db.prepare(
        "SELECT COUNT(*) as cnt FROM leads WHERE stage = 'won' AND DATE(updated_at) >= ?"
      ).get(weekAgoStr);

      // Tasks completed this week
      const completedTasks = db.prepare(
        "SELECT COUNT(*) as cnt FROM tasks WHERE DATE(completed_at) >= ?"
      ).get(weekAgoStr);

      // Tasks still pending
      const pendingTasks = db.prepare(
        "SELECT COUNT(*) as cnt FROM tasks WHERE status != 'done'"
      ).get();

      // Content stats
      const publishedContent = db.prepare(
        "SELECT COUNT(*) as cnt FROM content WHERE DATE(published_at) >= ?"
      ).get(weekAgoStr);
      const contentCreated = db.prepare(
        "SELECT COUNT(*) as cnt FROM content WHERE DATE(created_at) >= ?"
      ).get(weekAgoStr);

      // Agent activity
      const agentActivity = db.prepare(
        "SELECT agent_name, COUNT(*) as cnt FROM agent_logs WHERE DATE(created_at) >= ? GROUP BY agent_name ORDER BY cnt DESC"
      ).all(weekAgoStr);

      // Deals this week
      const deals = db.prepare(
        "SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as total FROM deals WHERE DATE(created_at) >= ?"
      ).get(weekAgoStr);

      let msg = [
        `📊 <b>Weekly Report</b>`,
        `📅 ${weekAgoStr} → ${todayStr}`,
        `━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `📇 <b>CRM Summary</b>`,
        `   New contacts: ${contacts.cnt} (total: ${totalContacts.cnt})`,
        `   New leads: ${leads.cnt}`,
        `   Won deals: ${wonLeads.cnt}`,
      ].join('\n');

      if (leadsByStage.length > 0) {
        msg += '\n\n🎯 <b>Pipeline Breakdown</b>\n';
        leadsByStage.forEach((s) => {
          msg += `   • ${s.stage}: ${s.cnt}\n`;
        });
      }

      msg += [
        ``,
        `✅ <b>Productivity</b>`,
        `   Tasks completed: ${completedTasks.cnt}`,
        `   Tasks pending: ${pendingTasks.cnt}`,
        ``,
        `📝 <b>Content</b>`,
        `   Created: ${contentCreated.cnt}`,
        `   Published: ${publishedContent.cnt}`,
        ``,
        `💰 <b>Deals</b>`,
        `   New deals: ${deals.cnt}`,
        `   Total value: ৳${deals.total.toLocaleString()}`,
      ].join('\n');

      if (agentActivity.length > 0) {
        msg += '\n\n🤖 <b>Agent Activity</b>\n';
        agentActivity.forEach((a) => {
          msg += `   • ${a.agent_name}: ${a.cnt} actions\n`;
        });
      }

      msg += '\n━━━━━━━━━━━━━━━━━━━━━━━';
      msg += '\n📈 <i>Keep building momentum! Type /start for quick actions.</i>';

      return ctx.replyWithHTML(msg);
    } catch (err) {
      console.error('Weekly report error:', err.message);
      return ctx.replyWithHTML('⚠️ Failed to generate weekly report.');
    }
  }
};
