// Customer Support Agent — FAQ handling, ticket creation, follow-ups
const BaseAgent = require('./baseAgent');
const db = require('../server/config/database');

class CustomerSupport extends BaseAgent {
  constructor() {
    super(
      'customer_support',
      'AI-powered customer support specialist',
      `You are a helpful and empathetic customer support specialist for CommandCenter AI.
Your role is to answer customer questions accurately and create support tickets when needed.

Guidelines:
- Always be polite, professional, and empathetic
- Provide clear, actionable answers
- If you don't know something, say so honestly and offer to escalate
- For technical issues, ask clarifying questions before suggesting solutions
- Include step-by-step instructions when explaining processes
- Offer to create a support ticket for complex issues
- Follow up with helpful links or resources when available
- Keep responses concise but thorough`
    );

    // Prepared statements
    this._supportStmts = {
      createTask: db.prepare(`
        INSERT INTO tasks (title, description, category, priority, status, assigned_to)
        VALUES (?, ?, 'support', ?, 'todo', 'support_team')
      `),
      getContact: db.prepare(`SELECT * FROM contacts WHERE id = ?`),
      getContactTasks: db.prepare(`
        SELECT * FROM tasks WHERE category = 'support' AND description LIKE ?
        ORDER BY created_at DESC LIMIT 5
      `),
      getRecentTickets: db.prepare(`
        SELECT * FROM tasks WHERE category = 'support'
        ORDER BY created_at DESC LIMIT ?
      `),
    };
  }

  /**
   * Answer a customer question using AI.
   * Uses askFast (Groq-first) for faster response times.
   *
   * @param {string} question - The customer's question
   * @returns {Promise<{answer: string, needsTicket: boolean}>}
   */
  async answerQuestion(question) {
    // Use thinkFast for lower latency customer support
    const answer = await this.thinkFast(
      `A customer is asking the following question. Please provide a helpful, accurate answer.

Customer Question: "${question}"

Instructions:
- If this is a common FAQ, answer directly and clearly
- If this requires human intervention, say so and suggest creating a support ticket
- If you need more information, ask specific clarifying questions
- End with "Would you like me to create a support ticket for this?" if the issue is complex

Provide your answer:`
    );

    // Simple heuristic: if the answer suggests a ticket, flag it
    const needsTicket =
      answer.toLowerCase().includes('support ticket') ||
      answer.toLowerCase().includes('escalate') ||
      answer.toLowerCase().includes('team will');

    this.remember('last_question', { question, answer, timestamp: new Date().toISOString() }, 'short', 3600);

    return { answer, needsTicket };
  }

  /**
   * Create a support ticket (task in the support category).
   *
   * @param {string} subject - Ticket subject/title
   * @param {string} description - Detailed description
   * @param {string} [priority='medium'] - Priority: low, medium, high, urgent
   * @returns {Promise<{ticketId: number, message: string}>}
   */
  async createTicket(subject, description, priority = 'medium') {
    try {
      const result = this._supportStmts.createTask.run(subject, description, priority);
      const ticketId = Number(result.lastInsertRowid);

      this.log('createTicket', subject, `Ticket #${ticketId} created`, 'success');

      return {
        ticketId,
        message: `✅ Support ticket #${ticketId} created successfully.\n` +
          `Subject: ${subject}\nPriority: ${priority}\nStatus: Open\n` +
          `Our support team will review this shortly.`,
      };
    } catch (err) {
      this.log('createTicket', subject, '', 'error', 0, 0, err.message);
      return {
        ticketId: null,
        message: `❌ Failed to create ticket: ${err.message}`,
      };
    }
  }

  /**
   * Suggest follow-up actions for a contact.
   *
   * @param {number} contactId - Contact ID from the contacts table
   * @returns {Promise<string>}
   */
  async suggestFollowUp(contactId) {
    const contact = this._supportStmts.getContact.get(contactId);
    if (!contact) {
      return `Contact #${contactId} not found.`;
    }

    // Check for any existing support tickets related to this contact
    const relatedTickets = this._supportStmts.getContactTasks.all(`%contact_id:${contactId}%`);

    const context = {
      name: contact.name,
      email: contact.email,
      company: contact.company,
      status: contact.status,
      source: contact.source,
      notes: contact.notes,
      recentTickets: relatedTickets.length,
      memberSince: contact.created_at,
    };

    return this.thinkFast(
      `Suggest follow-up actions for this customer:

${JSON.stringify(context, null, 2)}

Consider:
- How long since last contact
- Any unresolved issues (${relatedTickets.length} recent tickets)
- Customer relationship stage
- Proactive outreach opportunities

Provide 3-5 specific, actionable follow-up suggestions.`
    );
  }

  /**
   * Get recent support tickets.
   * @param {number} [limit=10]
   * @returns {Array<Object>}
   */
  getRecentTickets(limit = 10) {
    return this._supportStmts.getRecentTickets.all(limit);
  }
}

// Export singleton instance
module.exports = new CustomerSupport();
