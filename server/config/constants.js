// Application Constants
module.exports = {
  // Contact sources
  SOURCES: ['manual', 'telegram', 'facebook', 'website', 'referral', 'other'],

  // Lead stages (pipeline)
  LEAD_STAGES: ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'],

  // Deal stages
  DEAL_STAGES: ['pending', 'in_progress', 'completed', 'cancelled'],

  // Task statuses
  TASK_STATUS: ['todo', 'in_progress', 'review', 'done'],

  // Task priorities
  PRIORITIES: ['low', 'medium', 'high', 'urgent'],

  // Content types
  CONTENT_TYPES: ['post', 'story', 'reel', 'article', 'ad', 'caption'],

  // Content statuses
  CONTENT_STATUS: ['draft', 'scheduled', 'published', 'failed'],

  // Platforms
  PLATFORMS: ['facebook', 'instagram', 'all'],

  // Agent names
  AGENTS: {
    ORCHESTRATOR: 'orchestrator',
    CONTENT_CREATOR: 'content_creator',
    SOCIAL_MEDIA: 'social_media',
    CUSTOMER_SUPPORT: 'customer_support',
    ANALYTICS: 'analytics',
    TASK_MANAGER: 'task_manager',
  },

  // Agent statuses
  AGENT_STATUS: ['idle', 'working', 'error', 'offline'],

  // Pipeline stage colors (for dashboard)
  STAGE_COLORS: {
    new: '#667eea',
    contacted: '#00d2ff',
    qualified: '#7c3aed',
    proposal: '#f59e0b',
    negotiation: '#f97316',
    won: '#10b981',
    lost: '#ef4444',
    pending: '#6b7280',
    in_progress: '#3b82f6',
    completed: '#10b981',
    cancelled: '#ef4444',
  },

  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
};
