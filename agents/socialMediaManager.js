// Social Media Manager Agent — Facebook posting, scheduling, engagement analysis
const BaseAgent = require('./baseAgent');
const db = require('../server/config/database');
const facebook = require('../integrations/facebook');
const config = require('../server/config/env');

class SocialMediaManager extends BaseAgent {
  constructor() {
    super(
      'social_media',
      'AI-powered social media strategist and publisher',
      `You are an expert social media manager and strategist for CommandCenter AI.
Your role is to manage Facebook page posting, analyze engagement metrics, and optimize posting strategy.

Guidelines:
- Analyze engagement data to identify what content performs best
- Suggest optimal posting times based on audience activity
- Draft professional, on-brand responses to comments
- When analyzing trends, focus on actionable insights
- Track key metrics: reach, engagement rate, click-through rate
- Compare performance against previous periods`
    );

    // Prepared statements
    this._socialStmts = {
      getContent: db.prepare(`SELECT * FROM content WHERE id = ?`),
      updateContentPublished: db.prepare(`
        UPDATE content SET status = 'published', published_at = CURRENT_TIMESTAMP, fb_post_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `),
      updateContentFailed: db.prepare(`
        UPDATE content SET status = 'failed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `),
      getScheduledContent: db.prepare(`
        SELECT * FROM content
        WHERE status = 'scheduled' AND scheduled_at <= datetime('now')
        ORDER BY scheduled_at ASC
      `),
    };
  }

  /**
   * Publish content from the database to Facebook.
   * @param {number} contentId - ID from the content table
   * @returns {Promise<{success: boolean, postId: string|null, message: string}>}
   */
  async publishToFacebook(contentId) {
    const content = this._socialStmts.getContent.get(contentId);
    if (!content) {
      return { success: false, postId: null, message: `Content #${contentId} not found.` };
    }

    if (!facebook.isAvailable()) {
      this.log('publishToFacebook', `Content #${contentId}`, '', 'error', 0, 0, 'Facebook not configured');
      return {
        success: false,
        postId: null,
        message: 'Facebook integration not configured. Set FB_PAGE_ACCESS_TOKEN and FB_PAGE_ID in .env.',
      };
    }

    const pageId = config.facebook.pageId;

    try {
      const result = await facebook.publishPost(pageId, content.body);
      const fbPostId = result.id;

      // Update content status in database
      this._socialStmts.updateContentPublished.run(fbPostId, contentId);

      this.log('publishToFacebook', `Content #${contentId}`, `Published as ${fbPostId}`, 'success');

      return {
        success: true,
        postId: fbPostId,
        message: `✅ Published to Facebook! Post ID: ${fbPostId}`,
      };
    } catch (err) {
      this._socialStmts.updateContentFailed.run(contentId);
      this.log('publishToFacebook', `Content #${contentId}`, '', 'error', 0, 0, err.message);

      return {
        success: false,
        postId: null,
        message: `❌ Failed to publish: ${err.message}`,
      };
    }
  }

  /**
   * Analyze engagement trends for a Facebook page.
   * @param {string} [pageId] - Facebook Page ID (defaults to configured page)
   * @returns {Promise<{analysis: string, data: Object|null}>}
   */
  async analyzeTrends(pageId) {
    const pid = pageId || config.facebook.pageId;

    if (!facebook.isAvailable()) {
      return {
        analysis: await this.think(
          'Provide general social media engagement tips and best practices for a business Facebook page. ' +
          'Include advice about posting frequency, content types, and engagement strategies. ' +
          'Note: Real-time data unavailable because Facebook integration is not configured.'
        ),
        data: null,
      };
    }

    try {
      // Fetch real data
      const [posts, insights] = await Promise.all([
        facebook.getPagePosts(pid, null, 25),
        facebook.getPageInsights(pid, null, 'week').catch(() => null),
      ]);

      const dataContext = JSON.stringify({
        totalPosts: posts.data?.length || 0,
        posts: (posts.data || []).slice(0, 10).map(p => ({
          message: (p.message || '').substring(0, 100),
          created_time: p.created_time,
        })),
        insights: insights?.data || [],
      });

      const analysis = await this.think(
        `Analyze these Facebook page engagement trends and provide actionable insights:\n\n${dataContext}\n\n` +
        'Provide:\n1. Content performance summary\n2. Engagement patterns\n3. Top-performing content types\n4. Recommendations for improvement'
      );

      return { analysis, data: { posts: posts.data, insights: insights?.data } };
    } catch (err) {
      this.log('analyzeTrends', pid, '', 'error', 0, 0, err.message);
      return {
        analysis: `Could not fetch live data: ${err.message}. Here are general recommendations based on social media best practices...`,
        data: null,
      };
    }
  }

  /**
   * Suggest the best time to post based on engagement patterns.
   * @returns {Promise<string>}
   */
  async suggestPostingTime() {
    const lastAnalysis = this.recall('last_trend_analysis');
    const context = lastAnalysis
      ? `Based on our recent analysis: ${JSON.stringify(lastAnalysis)}`
      : 'No recent analysis data available.';

    return this.think(
      `Suggest the best times to post on Facebook for maximum engagement.
${context}

Consider:
- General best practices for business pages
- Day of week patterns
- Time zone considerations (assume UTC+6 / Bangladesh)
- Different content types may perform better at different times

Provide a schedule recommendation with specific times and days.`
    );
  }

  /**
   * Draft a reply to a social media comment based on sentiment.
   * @param {string} commentText - The original comment text
   * @param {string} [sentiment='neutral'] - Comment sentiment: positive, negative, neutral
   * @returns {Promise<string>}
   */
  async respondToComment(commentText, sentiment = 'neutral') {
    return this.think(
      `Draft a professional reply to this ${sentiment} social media comment:

"${commentText}"

Requirements:
- Tone: friendly and professional
- If negative: acknowledge concern, apologize if needed, offer solution
- If positive: thank them warmly, encourage engagement
- If neutral: provide helpful information, encourage further interaction
- Keep reply under 150 characters
- Don't use generic templates

Return ONLY the reply text.`,
      { temperature: 0.7 }
    );
  }

  /**
   * Get any content that is scheduled and due for publishing.
   * @returns {Array<Object>}
   */
  getScheduledContent() {
    return this._socialStmts.getScheduledContent.all();
  }
}

// Export singleton instance
module.exports = new SocialMediaManager();
