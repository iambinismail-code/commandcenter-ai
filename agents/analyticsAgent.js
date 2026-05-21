// Analytics Agent — Report generation, KPI analysis, trends
const BaseAgent = require('./baseAgent');
const db = require('../server/config/database');

class AnalyticsAgent extends BaseAgent {
  constructor() {
    super(
      'analytics',
      'Data analyst generating business insights and reports',
      `You are a data analyst and business intelligence specialist for CommandCenter AI.
Your role is to analyze CRM/ERP data and generate clear, actionable reports.

Guidelines:
- Present data with clear structure: summary → details → recommendations
- Use specific numbers and percentages, not vague statements
- Compare metrics against previous periods when possible
- Highlight both wins and areas for improvement
- End every report with 3-5 actionable recommendations
- Use emoji indicators: 📈 up, 📉 down, ➡️ flat
- Format reports in clean Markdown with tables where appropriate`
    );
  }

  /**
   * Generate a daily business summary.
   * @returns {Promise<{report: string, data: Object}>}
   */
  async generateDailyReport() {
    const data = this._collectDailyStats();
    const dataStr = JSON.stringify(data, null, 2);

    const report = await this.think(
      `Generate a daily business report based on this CRM/ERP data:

${dataStr}

Format the report with:
1. 📊 Executive Summary (2-3 sentence overview)
2. 👥 Contacts & Leads (new contacts, lead movement)
3. 💰 Deals & Revenue (new deals, pipeline value)
4. ✅ Tasks (completed, pending, overdue)
5. 📝 Content & Social Media (published, scheduled)
6. 🤖 AI Agent Activity (calls made, tokens used)
7. 💡 Recommendations (3-5 actionable items)

Use Markdown formatting.`
    );

    this.remember('last_daily_report', {
      date: new Date().toISOString().split('T')[0],
      data,
    }, 'long');

    return { report, data };
  }

  /**
   * Generate a weekly business summary.
   * @returns {Promise<{report: string, data: Object}>}
   */
  async generateWeeklyReport() {
    const data = this._collectWeeklyStats();
    const dataStr = JSON.stringify(data, null, 2);

    const report = await this.think(
      `Generate a comprehensive weekly business report based on this CRM/ERP data:

${dataStr}

Format the report with:
1. 📊 Week in Review (executive summary)
2. 👥 Customer Acquisition (new contacts, conversion rates)
3. 💰 Revenue & Pipeline (deal value, stage movement)
4. 📈 Lead Pipeline Health (stage distribution, velocity)
5. ✅ Task Completion Rate (done vs created)
6. 📝 Content Performance (published count, platforms)
7. 🤖 AI System Performance (provider usage, error rates)
8. 🎯 Next Week Priorities (5 recommendations)

Use Markdown formatting with tables where useful.`
    );

    this.remember('last_weekly_report', {
      weekOf: new Date().toISOString().split('T')[0],
      data,
    }, 'long');

    return { report, data };
  }

  /**
   * Analyze lead pipeline health.
   * @returns {Promise<{analysis: string, pipeline: Object}>}
   */
  async analyzeLeadPipeline() {
    const pipeline = this._getPipelineData();
    const pipelineStr = JSON.stringify(pipeline, null, 2);

    const analysis = await this.think(
      `Analyze this sales lead pipeline and provide strategic insights:

${pipelineStr}

Provide:
1. Pipeline Health Score (1-10)
2. Stage-by-stage analysis
3. Bottlenecks and stuck leads
4. Conversion rate estimates
5. Revenue forecast
6. Specific actions to move deals forward

Be data-driven and specific.`
    );

    return { analysis, pipeline };
  }

  /**
   * Get key performance indicators.
   * @returns {Promise<{kpis: Object, summary: string}>}
   */
  async getKPIs() {
    const kpis = this._calculateKPIs();
    const kpiStr = JSON.stringify(kpis, null, 2);

    const summary = await this.think(
      `Summarize these business KPIs in a concise, executive-friendly format:

${kpiStr}

For each KPI, indicate if it's: 📈 Good, 📉 Needs Attention, or ➡️ Stable.
Keep the summary under 300 words. Use bullet points.`
    );

    return { kpis, summary };
  }

  // ── Private data collection methods ──

  _collectDailyStats() {
    const today = new Date().toISOString().split('T')[0];

    return {
      date: today,
      contacts: {
        total: this._count('contacts'),
        newToday: this._countWhere('contacts', `date(created_at) = '${today}'`),
        active: this._countWhere('contacts', `status = 'active'`),
      },
      leads: {
        total: this._count('leads'),
        newToday: this._countWhere('leads', `date(created_at) = '${today}'`),
        byStage: this._groupCount('leads', 'stage'),
      },
      deals: {
        total: this._count('deals'),
        newToday: this._countWhere('deals', `date(created_at) = '${today}'`),
        totalValue: this._sum('deals', 'amount') || 0,
        byStage: this._groupCount('deals', 'stage'),
      },
      tasks: {
        total: this._count('tasks'),
        completedToday: this._countWhere('tasks', `date(completed_at) = '${today}'`),
        overdue: this._countWhere('tasks', `due_date < '${today}' AND status != 'done'`),
        byStatus: this._groupCount('tasks', 'status'),
      },
      content: {
        total: this._count('content'),
        publishedToday: this._countWhere('content', `date(published_at) = '${today}'`),
        scheduled: this._countWhere('content', `status = 'scheduled'`),
        drafts: this._countWhere('content', `status = 'draft'`),
      },
      agentActivity: {
        totalCalls: this._countWhere('agent_logs', `date(created_at) = '${today}'`),
        errors: this._countWhere('agent_logs', `date(created_at) = '${today}' AND status = 'error'`),
      },
    };
  }

  _collectWeeklyStats() {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    return {
      period: `${weekAgo} to ${now.toISOString().split('T')[0]}`,
      contacts: {
        total: this._count('contacts'),
        newThisWeek: this._countWhere('contacts', `date(created_at) >= '${weekAgo}'`),
      },
      leads: {
        total: this._count('leads'),
        newThisWeek: this._countWhere('leads', `date(created_at) >= '${weekAgo}'`),
        wonThisWeek: this._countWhere('leads', `stage = 'won' AND date(updated_at) >= '${weekAgo}'`),
        lostThisWeek: this._countWhere('leads', `stage = 'lost' AND date(updated_at) >= '${weekAgo}'`),
        byStage: this._groupCount('leads', 'stage'),
      },
      deals: {
        total: this._count('deals'),
        newThisWeek: this._countWhere('deals', `date(created_at) >= '${weekAgo}'`),
        totalValue: this._sum('deals', 'amount') || 0,
        completedValue: this._sumWhere('deals', 'amount', `stage = 'completed'`) || 0,
      },
      tasks: {
        created: this._countWhere('tasks', `date(created_at) >= '${weekAgo}'`),
        completed: this._countWhere('tasks', `date(completed_at) >= '${weekAgo}'`),
        overdue: this._countWhere('tasks', `due_date < date('now') AND status != 'done'`),
      },
      content: {
        created: this._countWhere('content', `date(created_at) >= '${weekAgo}'`),
        published: this._countWhere('content', `date(published_at) >= '${weekAgo}'`),
      },
      agentActivity: {
        totalCalls: this._countWhere('agent_logs', `date(created_at) >= '${weekAgo}'`),
        errors: this._countWhere('agent_logs', `date(created_at) >= '${weekAgo}' AND status = 'error'`),
        byAgent: this._groupCount('agent_logs', 'agent_name', `date(created_at) >= '${weekAgo}'`),
      },
    };
  }

  _getPipelineData() {
    return {
      byStage: this._groupCount('leads', 'stage'),
      byPriority: this._groupCount('leads', 'priority'),
      totalLeads: this._count('leads'),
      totalValue: this._sum('leads', 'value') || 0,
      avgValue: this._avg('leads', 'value') || 0,
      stageValues: this._groupSum('leads', 'stage', 'value'),
    };
  }

  _calculateKPIs() {
    const today = new Date().toISOString().split('T')[0];
    const totalLeads = this._count('leads');
    const wonLeads = this._countWhere('leads', `stage = 'won'`);
    const totalTasks = this._count('tasks');
    const doneTasks = this._countWhere('tasks', `status = 'done'`);

    return {
      totalContacts: this._count('contacts'),
      activeContacts: this._countWhere('contacts', `status = 'active'`),
      totalLeads,
      leadConversionRate: totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) + '%' : '0%',
      pipelineValue: this._sum('leads', 'value') || 0,
      totalRevenue: this._sumWhere('deals', 'amount', `stage = 'completed'`) || 0,
      pendingRevenue: this._sumWhere('deals', 'amount', `stage IN ('pending', 'in_progress')`) || 0,
      taskCompletionRate: totalTasks > 0 ? ((doneTasks / totalTasks) * 100).toFixed(1) + '%' : '0%',
      overdueTasks: this._countWhere('tasks', `due_date < '${today}' AND status != 'done'`),
      contentPublished: this._countWhere('content', `status = 'published'`),
      contentScheduled: this._countWhere('content', `status = 'scheduled'`),
    };
  }

  // ── Database helper methods ──

  _count(table) {
    try {
      const row = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get();
      return row.c;
    } catch { return 0; }
  }

  _countWhere(table, where) {
    try {
      const row = db.prepare(`SELECT COUNT(*) as c FROM ${table} WHERE ${where}`).get();
      return row.c;
    } catch { return 0; }
  }

  _sum(table, column) {
    try {
      const row = db.prepare(`SELECT COALESCE(SUM(${column}), 0) as s FROM ${table}`).get();
      return row.s;
    } catch { return 0; }
  }

  _sumWhere(table, column, where) {
    try {
      const row = db.prepare(`SELECT COALESCE(SUM(${column}), 0) as s FROM ${table} WHERE ${where}`).get();
      return row.s;
    } catch { return 0; }
  }

  _avg(table, column) {
    try {
      const row = db.prepare(`SELECT COALESCE(AVG(${column}), 0) as a FROM ${table}`).get();
      return Math.round(row.a * 100) / 100;
    } catch { return 0; }
  }

  _groupCount(table, groupCol, where) {
    try {
      const sql = where
        ? `SELECT ${groupCol}, COUNT(*) as count FROM ${table} WHERE ${where} GROUP BY ${groupCol}`
        : `SELECT ${groupCol}, COUNT(*) as count FROM ${table} GROUP BY ${groupCol}`;
      const rows = db.prepare(sql).all();
      const result = {};
      rows.forEach(r => { result[r[groupCol] || 'null'] = r.count; });
      return result;
    } catch { return {}; }
  }

  _groupSum(table, groupCol, sumCol) {
    try {
      const rows = db.prepare(
        `SELECT ${groupCol}, COALESCE(SUM(${sumCol}), 0) as total FROM ${table} GROUP BY ${groupCol}`
      ).all();
      const result = {};
      rows.forEach(r => { result[r[groupCol] || 'null'] = r.total; });
      return result;
    } catch { return {}; }
  }
}

// Export singleton instance
module.exports = new AnalyticsAgent();
