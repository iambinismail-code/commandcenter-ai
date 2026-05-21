// Content Scheduler — Checks for scheduled content and publishes it
const cron = require('node-cron');
const db = require('../server/config/database');

let schedulerTask = null;

/**
 * Start the content scheduler — runs every minute
 */
function start() {
  if (schedulerTask) {
    console.log('⏰ Scheduler already running');
    return;
  }

  schedulerTask = cron.schedule('* * * * *', async () => {
    try {
      const now = new Date().toISOString();

      // Find content that's scheduled and due
      const readyContent = db.prepare(
        "SELECT * FROM content WHERE status = 'scheduled' AND scheduled_at <= ? ORDER BY scheduled_at ASC"
      ).all(now);

      if (readyContent.length === 0) return;

      console.log(`⏰ Scheduler: Found ${readyContent.length} content item(s) ready to publish`);

      for (const item of readyContent) {
        try {
          // Try to publish via social media manager
          let socialManager;
          try {
            socialManager = require('./socialMediaManager');
          } catch (e) {
            // Social manager not available
          }

          if (socialManager && item.platform === 'facebook') {
            await socialManager.publishToFacebook(item.id);
          } else {
            // Mark as published even without Facebook (content was "published" to the system)
            db.prepare(
              "UPDATE content SET status = 'published', published_at = ?, updated_at = ? WHERE id = ?"
            ).run(now, now, item.id);
          }

          // Log the publish
          db.prepare(
            'INSERT INTO agent_logs (agent_name, action, input_summary, output_summary, status) VALUES (?, ?, ?, ?, ?)'
          ).run('scheduler', 'auto_publish', `Content #${item.id}: ${item.title}`, 'Published successfully', 'success');

          console.log(`  ✅ Published: "${item.title}" (#${item.id})`);
        } catch (err) {
          // Mark as failed
          db.prepare(
            "UPDATE content SET status = 'failed', updated_at = ? WHERE id = ?"
          ).run(now, item.id);

          db.prepare(
            'INSERT INTO agent_logs (agent_name, action, input_summary, output_summary, status, error_message) VALUES (?, ?, ?, ?, ?, ?)'
          ).run('scheduler', 'auto_publish_failed', `Content #${item.id}: ${item.title}`, null, 'error', err.message);

          console.error(`  ❌ Failed to publish "${item.title}":`, err.message);
        }
      }
    } catch (err) {
      console.error('Scheduler error:', err.message);
    }
  });

  console.log('⏰ Content scheduler started (checks every minute)');
}

/**
 * Stop the scheduler
 */
function stop() {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    console.log('⏰ Content scheduler stopped');
  }
}

module.exports = { start, stop };
