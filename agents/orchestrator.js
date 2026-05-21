// Agent Orchestrator — Intent classifier and command router
const db = require('../server/config/database');
const { ask } = require('../integrations/aiRouter');
const contentCreator = require('./contentCreator');
const socialMediaManager = require('./socialMediaManager');
const customerSupport = require('./customerSupport');
const analyticsAgent = require('./analyticsAgent');
const crmAgent = require('./crmAgent');
const taskManager = require('./taskManager');

const CLASSIFY_PROMPT = `Classify the user's intent into ONE category:
- crm: Add, list, or update contacts, leads, or deals
- content: Creating posts, articles, captions, hashtags
- social: Facebook posting, page stats, engagement
- support: Customer questions, tickets
- analytics: Reports, statistics, KPIs
- task: Tasks, to-do, reminders, deadlines
- image: Generate an image, picture, photo, artwork, design
- general: Greetings, questions, conversation

Reply with ONLY the category name.`;

/**
 * Extract text from AI router response
 */
function extractText(result) {
  if (!result) return '';
  if (typeof result === 'string') return result;
  if (result.text) return result.text;
  if (result.content) return result.content;
  return String(result);
}

/**
 * Get current date/time context string
 */
function getTimeContext() {
  const now = new Date();
  const options = { 
    timeZone: 'Asia/Dhaka',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true 
  };
  return now.toLocaleString('en-US', options);
}

/**
 * Classify user intent
 */
async function classifyIntent(input) {
  const lower = input.toLowerCase();

  if (/\b(contact|lead|deal|crm|pipeline)\b/.test(lower)) return 'crm';
  if (/\b(post|caption|article|hashtag|blog|write|content|create content)\b/.test(lower)) return 'content';
  if (/\b(facebook|fb|publish|schedule post|page stats|engagement|social)\b/.test(lower)) return 'social';
  if (/\b(customer|support|ticket|faq|complaint)\b/.test(lower)) return 'support';
  if (/\b(report|analytics|stats|kpi|revenue|chart|trend|summary)\b/.test(lower)) return 'analytics';
  if (/\b(task|todo|to-do|remind|deadline|priority|assign)\b/.test(lower)) return 'task';
  if (/\b(image|picture|photo|generate image|draw|artwork|design|create.*image|make.*image|banner|poster|logo)\b/.test(lower)) return 'image';

  try {
    const result = await ask(`${CLASSIFY_PROMPT}\n\nUser: "${input}"`, { temperature: 0.1, maxTokens: 20 });
    const text = extractText(result);
    const category = text.trim().toLowerCase().replace(/[^a-z_]/g, '');
    if (['crm', 'content', 'social', 'support', 'analytics', 'task', 'image', 'general'].includes(category)) {
      return category;
    }
  } catch (e) {}

  return 'general';
}

/**
 * Process a command from the user
 */
async function processCommand(input, context = {}) {
  const startTime = Date.now();
  const userName = context.userName || '';

  try {
    const intent = await classifyIntent(input);
    logActivity('orchestrator', 'route', input, intent, 'success');

    let response;
    switch (intent) {
      case 'crm':
        response = await crmAgent.processNaturalLanguage(input);
        break;
      case 'content':
        response = await contentCreator.generatePost(input, 'facebook');
        response = extractText(response.content || response);
        break;
      case 'social':
        response = extractText(await socialMediaManager.think(input));
        break;
      case 'support':
        response = extractText(await customerSupport.answerQuestion(input));
        break;
      case 'analytics':
        response = extractText(await analyticsAgent.generateDailyReport());
        break;
      case 'task':
        response = extractText(await taskManager.suggestNextAction());
        break;
      case 'image':
        // Return special image intent — bot handler will generate the image
        return { intent: 'image', agent: 'image', response: input, duration: Date.now() - startTime };
      default:
        response = await handleGeneral(input, userName);
        break;
    }

    response = extractText(response);
    const duration = Date.now() - startTime;
    logActivity('orchestrator', 'done', input, response.substring(0, 200), 'success', duration);

    return { intent, agent: intent, response: response || 'Done.', duration };
  } catch (err) {
    const duration = Date.now() - startTime;
    logActivity('orchestrator', 'error', input, err.message, 'error', duration);
    return { intent: 'error', agent: 'orchestrator', response: `Something went wrong: ${err.message}`, duration };
  }
}

/**
 * Handle general/conversational queries
 */
async function handleGeneral(input, userName = '') {
  const greeting = userName ? `${userName} Sir` : 'Sir';
  const currentTime = getTimeContext();

  try {
    const result = await ask(
      `You are the personal assistant of ${greeting} at Bin Group.

RULES:
- Start with "Hello ${greeting}" for greetings, or "${greeting}," for other responses
- Be natural, warm but brief. 1-3 sentences max.
- For greetings like "hello", "hi", "hey" — just greet back warmly and ask how you can help. Nothing more.
- Only mention time/date if the user SPECIFICALLY asks for it. Current time: ${currentTime}
- NEVER argue with the user or correct them
- NEVER say "let me know if you need anything" or any closing filler
- NEVER mention being an AI, model, or bot
- You are simply their assistant
- Be helpful, not robotic

User: "${input}"`,
      { temperature: 0.7, maxTokens: 200 }
    );
    return extractText(result);
  } catch (e) {
    return `Hello ${greeting}, how can I help you?`;
  }
}

/**
 * Get status of all agents
 */
function getAgentStatuses() {
  const agentList = [
    { name: 'orchestrator', display: '🧠 Orchestrator', description: 'Routes commands' },
    { name: 'content_creator', display: '🎨 Content Creator', description: 'Posts & articles' },
    { name: 'social_media', display: '📱 Social Media', description: 'Facebook management' },
    { name: 'customer_support', display: '🎧 Support', description: 'Customer help' },
    { name: 'analytics', display: '📊 Analytics', description: 'Reports & insights' },
    { name: 'task_manager', display: '📋 Tasks', description: 'Task management' },
  ];

  return agentList.map((agent) => {
    const lastLog = db.prepare('SELECT * FROM agent_logs WHERE agent_name = ? ORDER BY created_at DESC LIMIT 1').get(agent.name);
    const countResult = db.prepare('SELECT COUNT(*) as cnt FROM agent_logs WHERE agent_name = ?').get(agent.name);
    let status = 'idle';
    if (lastLog) {
      if (Date.now() - new Date(lastLog.created_at).getTime() < 60000) status = 'working';
      if (lastLog.status === 'error') status = 'error';
    }
    return { ...agent, status, totalActions: countResult?.cnt || 0, lastActivity: lastLog?.created_at || null, lastAction: lastLog?.action || null };
  });
}

function logActivity(agentName, action, input, output, status, duration = 0) {
  try {
    db.prepare('INSERT INTO agent_logs (agent_name, action, input_summary, output_summary, status, duration_ms) VALUES (?, ?, ?, ?, ?, ?)')
      .run(agentName, action, input ? input.substring(0, 500) : null, output ? String(output).substring(0, 500) : null, status, duration);
  } catch (e) {}
}

module.exports = { processCommand, getAgentStatuses, classifyIntent, getTimeContext };
