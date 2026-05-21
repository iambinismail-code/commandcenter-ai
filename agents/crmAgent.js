const { askFast } = require('../integrations/aiRouter');
const db = require('../server/config/database');

const SYSTEM_PROMPT = `You are the CRM AI agent.
Your job is to parse natural language commands and extract structured data.
The user wants to perform an action on their CRM system (contacts, leads, deals).

Extract the action and data as a strict JSON object. No markdown, no explanations.

Supported actions:
1. "add_contact": Requires "name" and optional "phone".

Examples:
Input: "Add a new contact named John Doe phone 017123"
Output: {"action":"add_contact", "name":"John Doe", "phone":"017123"}

Input: "I met Alice today, add her to my contacts."
Output: {"action":"add_contact", "name":"Alice"}

If you don't understand the action, return {"action":"unknown"}`;

async function processNaturalLanguage(input) {
  try {
    const response = await askFast(`${SYSTEM_PROMPT}\n\nInput: "${input}"`, { temperature: 0.1 });
    
    // Extract JSON safely
    const text = response.text || response.content || String(response);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return 'I could not understand the CRM command.';
    
    const data = JSON.parse(jsonMatch[0]);

    if (data.action === 'add_contact') {
      if (!data.name) return 'Please provide a name for the contact.';
      const phone = data.phone || null;
      const result = db.prepare('INSERT INTO contacts (name, phone, source) VALUES (?, ?, ?)').run(data.name, phone, 'telegram');
      return `✅ Added contact <b>${data.name}</b> (Phone: ${phone || 'N/A'}) to the CRM.`;
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
