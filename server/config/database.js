// Database Configuration & Migrations (SQLite via better-sqlite3)
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./env');

// Ensure data directory exists
const dataDir = path.dirname(path.resolve(config.db.path));
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.resolve(config.db.path));

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run migrations
function migrate() {
  db.exec(`
    -- =====================
    -- CRM: Contacts
    -- =====================
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      source TEXT DEFAULT 'manual',
      status TEXT DEFAULT 'active',
      tags TEXT DEFAULT '[]',
      notes TEXT,
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- =====================
    -- CRM: Leads
    -- =====================
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      value REAL DEFAULT 0,
      stage TEXT DEFAULT 'new',
      priority TEXT DEFAULT 'medium',
      assigned_agent TEXT,
      source TEXT,
      notes TEXT,
      expected_close DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- =====================
    -- CRM: Deals
    -- =====================
    CREATE TABLE IF NOT EXISTS deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      currency TEXT DEFAULT 'BDT',
      stage TEXT DEFAULT 'pending',
      invoice_number TEXT,
      due_date DATE,
      paid_at DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- =====================
    -- Content Management
    -- =====================
    CREATE TABLE IF NOT EXISTS content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT,
      type TEXT DEFAULT 'post',
      platform TEXT DEFAULT 'facebook',
      status TEXT DEFAULT 'draft',
      media_urls TEXT DEFAULT '[]',
      scheduled_at DATETIME,
      published_at DATETIME,
      fb_post_id TEXT,
      engagement_data TEXT DEFAULT '{}',
      created_by TEXT DEFAULT 'user',
      agent_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- =====================
    -- Task Management (ERP)
    -- =====================
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'general',
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'todo',
      assigned_to TEXT DEFAULT 'user',
      due_date DATE,
      completed_at DATETIME,
      parent_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
      tags TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- =====================
    -- Agent System: Activity Log
    -- =====================
    CREATE TABLE IF NOT EXISTS agent_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_name TEXT NOT NULL,
      action TEXT NOT NULL,
      input_summary TEXT,
      output_summary TEXT,
      status TEXT DEFAULT 'success',
      tokens_used INTEGER DEFAULT 0,
      duration_ms INTEGER DEFAULT 0,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- =====================
    -- Agent System: Memory
    -- =====================
    CREATE TABLE IF NOT EXISTS agent_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_name TEXT NOT NULL,
      memory_type TEXT DEFAULT 'short',
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- =====================
    -- Settings
    -- =====================
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- =====================
    -- Indexes for performance
    -- =====================
    CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
    CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
    CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
    CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
    CREATE INDEX IF NOT EXISTS idx_leads_contact ON leads(contact_id);
    CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
    CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals(contact_id);
    CREATE INDEX IF NOT EXISTS idx_content_status ON content(status);
    CREATE INDEX IF NOT EXISTS idx_content_scheduled ON content(scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    CREATE INDEX IF NOT EXISTS idx_agent_logs_agent ON agent_logs(agent_name);
    CREATE INDEX IF NOT EXISTS idx_agent_logs_created ON agent_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_agent_memory_agent ON agent_memory(agent_name);
  `);

  console.log('✅ Database migrations complete');
}

// Run migrations on load
migrate();

module.exports = db;
