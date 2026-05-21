// Task Manager Agent — Task automation, prioritization, reminders
const BaseAgent = require('./baseAgent');
const db = require('../server/config/database');
const { askFast } = require('../integrations/aiRouter');

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

  /**
   * Parse natural language command and execute task actions (create, complete, update priority, list).
   * Falls back to suggestNextAction if the intent is not recognized.
   * @param {string} input - User natural language text
   * @param {string} [timeContext=''] - Current date/time context
   * @returns {Promise<string>}
   */
  async processNaturalLanguage(input, timeContext = '') {
    const SYSTEM_PROMPT_NL = `You are the Task Manager AI agent for CommandCenter AI.
Your job is to parse natural language commands and extract structured action and data as a strict JSON object.
No markdown (e.g. do NOT wrap in \`\`\`json ... \`\`\`), no explanations, just a single raw JSON object.

Current date/time context: {timeContext}

Supported actions:
1. "create_task": Requires "title", optional "description", "priority" ("low", "medium", "high", "urgent"), "category" ("general", "content", "support", "sales"), "due_date" (resolve relative dates like "tomorrow" to YYYY-MM-DD format using current date/time context).
   - Example input: "Remind me to check the contract by tomorrow morning"
   - Expected JSON: {"action":"create_task", "title":"check the contract", "priority":"medium", "category":"general", "due_date":"YYYY-MM-DD"}

2. "complete_task": Requires either "task_id" (number) or "title" (string for fuzzy search).
   - Example input: "mark task 5 as done"
   - Expected JSON: {"action":"complete_task", "task_id":5}
   - Example input: "complete task check warehouse"
   - Expected JSON: {"action":"complete_task", "title":"check warehouse"}

3. "update_priority": Requires "task_id" (number) and "priority" ("low", "medium", "high", "urgent").
   - Example input: "make task 3 urgent"
   - Expected JSON: {"action":"update_priority", "task_id":3, "priority":"urgent"}

4. "list_tasks": Request to see tasks.
   - Example input: "show my pending tasks"
   - Expected JSON: {"action":"list_tasks"}

If you don't understand the action or it's not supported, return {"action":"unknown"}`;

    try {
      const prompt = SYSTEM_PROMPT_NL.replace('{timeContext}', timeContext || new Date().toISOString());
      const response = await askFast(`${prompt}\n\nInput: "${input}"`, { temperature: 0.1 });
      
      const text = response.text || response.content || String(response);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.suggestNextAction();
      }

      const data = JSON.parse(jsonMatch[0]);

      if (data.action === 'create_task') {
        if (!data.title) return 'Please provide a title for the task.';
        const priority = data.priority || 'medium';
        const category = data.category || 'general';
        const dueDate = data.due_date || null;
        const description = data.description || '';

        const result = db.prepare(
          'INSERT INTO tasks (title, description, category, priority, status, due_date, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(data.title, description, category, priority, 'todo', dueDate, 'user');
        
        const taskId = Number(result.lastInsertRowid);
        this.log('createTaskNL', data.title, `Task #${taskId} created`, 'success');

        let msg = `✅ Task <b>#${taskId}</b> created!\n`;
        msg += `📌 Title: <b>${data.title}</b>\n`;
        msg += `🔘 Priority: <b>${priority}</b> | Category: <b>${category}</b>\n`;
        if (dueDate) {
          msg += `📅 Due Date: <b>${dueDate}</b>\n`;
        }
        return msg;
      }

      if (data.action === 'complete_task') {
        let task = null;
        if (data.task_id) {
          task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(data.task_id);
        } else if (data.title) {
          task = db.prepare('SELECT * FROM tasks WHERE title LIKE ? LIMIT 1').get(`%${data.title}%`);
        }

        if (!task) {
          return `❌ Task "${data.task_id || data.title || 'unknown'}" not found.`;
        }

        db.prepare(
          "UPDATE tasks SET status = 'done', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).run(task.id);
        this.log('completeTaskNL', `Task #${task.id}`, 'Completed', 'success');

        return `✅ Task <b>#${task.id}</b> ("<s>${task.title}</s>") completed! 🎉`;
      }

      if (data.action === 'update_priority') {
        if (!data.task_id || !data.priority) {
          return 'Please provide both task_id and priority.';
        }

        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(data.task_id);
        if (!task) {
          return `❌ Task #${data.task_id} not found.`;
        }

        const validPriorities = ['low', 'medium', 'high', 'urgent'];
        const priority = (data.priority || '').toLowerCase();
        if (!validPriorities.includes(priority)) {
          return `❌ Invalid priority "${priority}". Valid priorities: ${validPriorities.join(', ')}`;
        }

        db.prepare('UPDATE tasks SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(priority, task.id);
        this.log('updatePriorityNL', `Task #${task.id}`, `Priority → ${priority}`, 'success');

        return `🔴 Priority updated for Task <b>#${task.id}</b> ("${task.title}") to <b>${priority}</b>.`;
      }

      if (data.action === 'list_tasks') {
        const tasks = db.prepare(
          "SELECT id, title, priority, due_date FROM tasks WHERE status != 'done' ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END, created_at DESC LIMIT 10"
        ).all();

        if (tasks.length === 0) {
          return '✅ You have no pending tasks! 🎉';
        }

        const prioEmoji = { urgent: '🔴', high: '🟡', medium: '🔵', low: '⚪' };
        let msg = '📋 <b>Your Pending Tasks</b>\n━━━━━━━━━━━━━━━━━━━\n\n';
        tasks.forEach(t => {
          const prio = prioEmoji[t.priority] || '🔵';
          const due = t.due_date ? ` 📅 <i>${t.due_date}</i>` : '';
          msg += `${prio} <b>#${t.id}</b> ${t.title}${due}\n`;
        });
        return msg;
      }

      // Action unknown or conversational request -> fall back to suggestion
      return this.suggestNextAction();
    } catch (err) {
      console.error('taskManager NL error:', err.message);
      return 'Failed to process task command.';
    }
  }
}

// Export singleton instance
module.exports = new TaskManager();
