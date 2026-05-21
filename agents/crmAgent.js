const { askFast } = require('../integrations/aiRouter');
const db = require('../server/config/database');

const SYSTEM_PROMPT = `You are the CRM AI agent for CommandCenter AI.
Your job is to parse natural language commands and extract structured action and data as a strict JSON object.
No markdown (e.g. do NOT wrap in \`\`\`json ... \`\`\`), no explanations, just a single raw JSON object.

Current date/time context: {timeContext}

Supported actions:
1. "add_contact": Requires "name" and optional "phone", "email", "company", "notes".
   - Example input: "Add contact John Doe, phone 01712345678, email john@example.com"
   - Expected JSON: {"action":"add_contact", "name":"John Doe", "phone":"01712345678", "email":"john@example.com"}

2. "add_lead": Requires "title" (e.g. project name or lead title), optional "value" (number), "contact_name" (name of contact to associate), "expected_close" (YYYY-MM-DD format, resolve relative dates using current date context), "priority" ("low", "medium", "high").
   - Example input: "Add a lead for website development worth 50000 for John Doe due next month"
   - Expected JSON: {"action":"add_lead", "title":"website development", "value":50000, "contact_name":"John Doe", "expected_close":"YYYY-MM-DD", "priority":"medium"}

3. "move_lead": Requires either "lead_id" (number) or "title" (string for fuzzy matching), and "stage" (must be one of: "new", "contacted", "qualified", "proposal", "negotiation", "won", "lost").
   - Example input: "move lead 12 to won"
   - Expected JSON: {"action":"move_lead", "lead_id":12, "stage":"won"}
   - Example input: "mark lead website project as proposal"
   - Expected JSON: {"action":"move_lead", "title":"website project", "stage":"proposal"}

If you don't understand the action or it's not supported, return {"action":"unknown"}`;

async function processNaturalLanguage(input, timeContext = '') {
  try {
    const prompt = SYSTEM_PROMPT.replace('{timeContext}', timeContext || new Date().toISOString());
    const response = await askFast(`${prompt}\n\nInput: "${input}"`, { temperature: 0.1 });
    
    // Extract JSON safely
    const text = response.text || response.content || String(response);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return 'I could not understand the CRM command.';
    
    const data = JSON.parse(jsonMatch[0]);

    if (data.action === 'add_contact') {
      if (!data.name) return 'Please provide a name for the contact.';
      const phone = data.phone || null;
      const email = data.email || null;
      const company = data.company || null;
      const notes = data.notes || null;
      
      const result = db.prepare(
        'INSERT INTO contacts (name, phone, email, company, notes, source) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(data.name, phone, email, company, notes, 'telegram');
      
      const contactId = Number(result.lastInsertRowid);
      return `✅ Added contact <b>${data.name}</b> (ID: #${contactId}, Phone: ${phone || 'N/A'}) to the CRM.`;
    }

    if (data.action === 'add_lead') {
      if (!data.title) return 'Please provide a title for the lead.';
      
      let contactId = null;
      let contactNameResolved = '';
      if (data.contact_name) {
        const contact = db.prepare('SELECT id, name FROM contacts WHERE name LIKE ? LIMIT 1').get(`%${data.contact_name}%`);
        if (contact) {
          contactId = contact.id;
          contactNameResolved = contact.name;
        }
      }
      
      const value = data.value || 0;
      const priority = data.priority || 'medium';
      const expectedClose = data.expected_close || null;
      
      const result = db.prepare(
        'INSERT INTO leads (contact_id, title, value, stage, priority, expected_close, source) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(contactId, data.title, value, 'new', priority, expectedClose, 'telegram');
      
      const leadId = Number(result.lastInsertRowid);
      
      let msg = `✅ Lead <b>#${leadId}</b> created: "${data.title}"\n`;
      msg += `💰 Value: <b>${value.toLocaleString()} BDT</b>\n`;
      msg += `🔘 Stage: new | Priority: ${priority}\n`;
      if (contactNameResolved) {
        msg += `📇 Contact: <b>${contactNameResolved}</b> (ID: #${contactId})\n`;
      }
      if (expectedClose) {
        msg += `📅 Expected Close: <b>${expectedClose}</b>\n`;
      }
      return msg;
    }

    if (data.action === 'move_lead') {
      let lead = null;
      if (data.lead_id) {
        lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(data.lead_id);
      } else if (data.title) {
        lead = db.prepare('SELECT * FROM leads WHERE title LIKE ? LIMIT 1').get(`%${data.title}%`);
      }
      
      if (!lead) {
        return `❌ Lead "${data.lead_id || data.title || 'unknown'}" not found.`;
      }
      
      const validStages = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
      const stage = (data.stage || '').toLowerCase();
      
      if (!validStages.includes(stage)) {
        return `❌ Invalid stage "${stage}". Valid stages are: ${validStages.join(', ')}`;
      }
      
      db.prepare('UPDATE leads SET stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(stage, lead.id);
      return `🔄 Lead <b>#${lead.id}</b> ("${lead.title}") moved to stage: <b>${stage}</b>.`;
    }

    return 'That CRM action is not fully supported by natural language yet. Try using the CRM menu buttons.';
  } catch (err) {
    console.error('crmAgent error:', err.message);
    return 'Failed to process CRM command.';
  }
}

module.exports = {
  processNaturalLanguage
};
