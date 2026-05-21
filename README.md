# 🚀 CommandCenter AI

**AI-Powered CRM/ERP with Telegram Bot, Facebook Integration & Multi-Agent System**

Your personal AI assistant group that manages your business from Telegram.

---

## ✨ Features

### 📇 CRM (Customer Relationship Management)
- Contact management with search, filters, and tags
- Lead pipeline with Kanban board (New → Won/Lost)
- Deal tracking with revenue analytics
- All manageable via Telegram or Web Dashboard

### 🤖 AI Agent System
| Agent | Role |
|:---|:---|
| 🧠 **Orchestrator** | Routes your commands to the right specialist |
| 🎨 **Content Creator** | Generates posts, captions, articles, hashtags |
| 📱 **Social Media Manager** | Facebook posting, scheduling, engagement analysis |
| 🎧 **Customer Support** | FAQ answers, ticket creation, follow-ups |
| 📊 **Analytics** | Daily/weekly reports, KPI tracking, trend analysis |
| 📋 **Task Manager** | Task prioritization, reminders, deadline tracking |

### 📱 Telegram Bot
- 20+ commands organized by category
- Inline keyboard buttons for quick actions
- Multi-step wizards for complex operations
- Real-time notifications

### 🌐 Web Dashboard
- Premium glassmorphism dark theme
- Real-time analytics and charts
- CRM pipeline Kanban board
- Content calendar and social media hub
- Agent activity monitor

### 📘 Facebook Integration
- Publish posts to your Facebook pages
- Schedule content for future publishing
- Track engagement metrics
- Manage multiple pages

---

## 🛠️ Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or later
- A Telegram Bot Token (from [@BotFather](https://t.me/BotFather))

### 1. Install Dependencies
```bash
cd commandcenter-ai
npm install
```

### 2. Configure Environment
```bash
# Copy the example env file
cp .env.example .env

# Edit .env with your API keys (all free!)
```

**Required Keys:**
| Key | Where to Get It | Cost |
|:---|:---|:---|
| `TELEGRAM_BOT_TOKEN` | [@BotFather](https://t.me/BotFather) on Telegram | Free |
| `TELEGRAM_OWNER_ID` | [@userinfobot](https://t.me/userinfobot) on Telegram | Free |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) | Free |
| `GROQ_API_KEY` | [Groq Console](https://console.groq.com/keys) | Free |
| `FB_PAGE_ACCESS_TOKEN` | [Meta Developer](https://developers.facebook.com/) | Free |
| `FB_PAGE_ID` | Your Facebook Page settings | Free |

### 3. Start the Server
```bash
# Development
npm run dev

# The server starts on http://localhost:3000
# Dashboard: http://localhost:3000
# API: http://localhost:3000/api
# Telegram bot auto-starts if token is configured
```

---

## 📱 Telegram Commands

| Command | Description |
|:---|:---|
| `/start` | Welcome message with quick actions |
| `/help` | List all commands |
| `/crm list` | View recent contacts |
| `/crm add <name> <phone>` | Add a contact |
| `/crm search <query>` | Search contacts |
| `/lead list` | View leads by stage |
| `/lead new <title>` | Create a lead |
| `/lead pipeline` | Pipeline summary |
| `/content create <topic>` | AI-generate content |
| `/content list` | View content |
| `/social post <message>` | Post to Facebook |
| `/task add <title>` | Create a task |
| `/task list` | View pending tasks |
| `/task done <id>` | Complete a task |
| `/agent status` | Check all agents |
| `/agent ask <question>` | Ask the AI team |
| `/report daily` | Daily summary |
| `/report weekly` | Weekly analytics |

---

## 🏗️ Architecture

```
commandcenter-ai/
├── server/          # Express API server
│   ├── config/      # Database, env, constants
│   ├── routes/      # REST API endpoints
│   └── middleware/   # Auth, error handling
├── bot/             # Telegram bot (Telegraf)
│   └── commands/    # Bot command handlers
├── agents/          # AI agent system
│   ├── orchestrator # Intent routing
│   └── specialists/ # 5 specialist agents
├── integrations/    # External API clients
│   ├── gemini       # Google Gemini AI
│   ├── groq         # Groq AI (fast)
│   └── facebook     # Meta Graph API
├── dashboard/       # Web SPA
│   ├── css/         # Design system
│   └── js/          # Pages & components
└── data/            # SQLite database
```

---

## 💰 Cost

**$0/month** — All APIs used have generous free tiers:
- Google Gemini: ~1500 requests/day free
- Groq: ~30 requests/minute free
- Meta Graph API: Free for page management
- Telegram Bot API: Completely free
- SQLite: No database costs

---

## 📄 License

MIT
