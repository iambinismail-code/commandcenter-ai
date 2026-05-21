// Task Manager Agent — Task automation, prioritization, reminders
const BaseAgent = require('./baseAgent');
const db = require('../server/config/database');

class TaskManager extends BaseAgent {
  constructor() {
    super(
      'task_manager',
      'Efficient task management and prioritization assistant',
      `You are an efficient task management assistant for CommandCenter AI.
Your role is to help organize, prioritize, and track tasks across the business.

Guidelines:
- Prioritize tasks using the Eisenhower Matrix: urgent/important framework
- Consider due dates, business impact, and dependencies
- Suggest realistic timelines for task completion
- Group related tasks for batch processing
- Flag overdue tasks with specific remediation suggestions
- When suggesting next actions, consider current workload and priorities`
    );

    // Prepared statements
    this._taskStmts = {
      createTask: db.prepare(`
        INSERT INTO tasks (title, description, category, priority, status, due_date, assigned_to)
        VALUES (?, ?, ?, ?, 'todo', ?, 'user')
      `),
      getAllTasks: db.prepare(`
        SELECT * FROM tasks WHERE status != 'done'
        ORDER BY
          CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END,
          due_date ASC NULLS LAST
      `),
      getOverdueTasks: db.prepare(`
        SELECT * FROM tasks
        WHERE due_date < date('now') AND status != 'done'
        ORDER BY due_date ASC
      `),
      getTasksByCategory: db.prepare(`
        SELECT * FROM tasks WHERE category = ? AND status != 'done'
        ORDER BY priority DESC, due_date ASC
      `),
      updateTaskStatus: db.prepare(`
        UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP,
        completed_at = CASE WHEN ? = 'done' THEN CURRENT_TIMESTAMP ELSE completed_at END
        WHERE id = ?
      `),
      getTaskStats: db.prepare(`
        SELECT
          status,
          COUNT(*) as count,
          SUM(CASE WHEN due_date < date('now') AND status != 'done' THEN 1 ELSE 0 END) as overdue
        FROM tasks GROUP BY status
      `),
    };
  }

  /**
   * Use AI to prioritize all open tasks.
   * @returns {Promise<{prioritized: string, tasks: Array}>}
   */
  async prioritizeTasks() {
    const tasks = this._taskStmts.getAllTasks.all();

    if (tasks.length === 0) {
      return {
        prioritized: '✅ No open tasks to prioritize! Your task list is clear.',
        tasks: [],
      };
    }

    const taskSummary = tasks.map(t => ({
      id: t.id,
      title: t.title,
      category: t.category,
      priority: t.priority,
      status: t.status,
      dueDate: t.due_date,
      createdAt: t.created_at,
    }));

    const prioritized = await this.think(
      `Prioritize these ${tasks.length} open tasks and suggest an optimal order of execution:

${JSON.stringify(taskSummary, null, 2)}

Today's date: ${new Date().toISOString().split('T')[0]}

For each task, provide:
1. Recommended priority (keep, raise, or lower)
2. Whether it's urgent/important (Eisenhower Matrix quadrant)
3. Suggested action (do now, schedule, delegate, eliminate)

Then provide a recommended execution order as a numbered list.
Flag any overdue tasks that need immediate attention.`
    );

    return { prioritized, tasks };
  }

  /**
   * Suggest what should be done next based on current tasks.
   * @returns {Promise<string>}
   */
  async suggestNextAction() {
    const tasks = this._taskStmts.getAllTasks.all();
    const overdue = this._taskStmts.getOverdueTasks.all();
    const stats = this._taskStmts.getTaskStats.all();

    const context = {
      totalOpen: tasks.length,
      overdue: overdue.length,
      overdueItems: overdue.slice(0, 5).map(t => ({
        title: t.title,
        dueDate: t.due_date,
        priority: t.priority,
      })),
      topPriority: tasks.slice(0, 5).map(t => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        dueDate: t.due_date,
        category: t.category,
      })),
      stats: stats,
      currentTime: new Date().toISOString(),
    };

    return this.thinkFast(
      `Based on the current task situation, suggest what should be done RIGHT NOW:

${JSON.stringify(context, null, 2)}

Provide:
1. The single most important thing to do right now (with task ID if applicable)
2. Why this is the top priority
3. Estimated time to complete
4. What to do after that (next 2-3 items)

Be specific and actionable. Keep it concise.`
    );
  }

  /**
   * Create a new task in the database.
   * @param {string} title - Task title
   * @param {string} [category='general'] - Category: general, support, content, sales, etc.
   * @param {string} [priority='medium'] - Priority: low, medium, high, urgent
   * @param {string} [description=''] - Task description
   * @param {string|null} [dueDate=null] - Due date in YYYY-MM-DD format
   * @returns {{taskId: number, message: string}}
   */
  createTask(title, category = 'general', priority = 'medium', description = '', dueDate = null) {
    try {
      const result = this._taskStmts.createTask.run(title, description, category, priority, dueDate);
      const taskId = Number(result.lastInsertRowid);

      this.log('createTask', title, `Task #${taskId} created`, 'success');

      return {
        taskId,
        message: `✅ Task #${taskId} created: "${title}" [${priority}] in ${category}${dueDate ? ` — due ${dueDate}` : ''}`,
      };
    } catch (err) {
      this.log('createTask', title, '', 'error', 0, 0, err.message);
      return {
        taskId: null,
        message: `❌ Failed to create task: ${err.message}`,
      };
    }
  }

  /**
   * Get all overdue tasks.
   * @returns {Array<Object>}
   */
  getOverdueTasks() {
    return this._taskStmts.getOverdueTasks.all();
  }

  /**
   * Update a task's status.
   * @param {number} taskId - Task ID
   * @param {string} status - New status: todo, in_progress, review, done
   * @returns {{success: boolean, message: string}}
   */
  updateTaskStatus(taskId, status) {
    try {
      this._taskStmts.updateTaskStatus.run(status, status, taskId);
      this.log('updateTaskStatus', `Task #${taskId}`, `Status → ${status}`, 'success');
      return { success: true, message: `✅ Task #${taskId} updated to "${status}".` };
    } catch (err) {
      return { success: false, message: `❌ Failed to update task: ${err.message}` };
    }
  }
}

// Export singleton instance
module.exports = new TaskManager();
