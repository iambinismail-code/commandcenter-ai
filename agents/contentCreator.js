// Content Creator Agent — Generates posts, captions, hashtags, articles
const BaseAgent = require('./baseAgent');
const db = require('../server/config/database');

class ContentCreator extends BaseAgent {
  constructor() {
    super(
      'content_creator',
      'AI-powered content creator for social media and blogs',
      `You are an expert content creator and social media copywriter for CommandCenter AI.
Your role is to generate engaging, platform-optimized content for businesses.

Guidelines:
- Write compelling, concise copy tailored to the requested platform
- Use appropriate tone: professional for LinkedIn, casual for Facebook, punchy for Twitter
- Include relevant emojis where appropriate (don't overdo it)
- When generating hashtags, focus on a mix of popular and niche tags
- For articles, use clear structure with headers, bullet points, and a strong conclusion
- Always end posts with a call-to-action when appropriate
- Content should be original and avoid generic filler phrases`
    );

    // Prepared statements for content operations
    this._contentStmts = {
      insertContent: db.prepare(`
        INSERT INTO content (title, body, type, platform, status, created_by, agent_name)
        VALUES (?, ?, ?, ?, 'draft', 'agent', ?)
      `),
      getContent: db.prepare(`SELECT * FROM content WHERE id = ?`),
    };
  }

  /**
   * Generate a social media post.
   * @param {string} topic - What to write about
   * @param {string} [platform='facebook'] - Target platform
   * @param {string} [style='engaging'] - Writing style
   * @returns {Promise<{content: string, id: number}>}
   */
  async generatePost(topic, platform = 'facebook', style = 'engaging') {
    const prompt = `Create a ${style} social media post for ${platform} about: "${topic}".

Requirements:
- Optimized for ${platform} engagement
- Style: ${style}
- Include 2-4 relevant hashtags at the end
- Keep it under 280 characters for Twitter, under 500 for others
- End with a call-to-action if appropriate

Return ONLY the post content, no explanations.`;

    const content = await this.think(prompt, { temperature: 0.8 });

    // Save to database
    const result = this._contentStmts.insertContent.run(
      `${platform} post: ${topic}`,
      content,
      'post',
      platform,
      this.name
    );

    this.remember(`last_post_${platform}`, {
      id: result.lastInsertRowid,
      topic,
      createdAt: new Date().toISOString(),
    });

    return {
      content,
      id: Number(result.lastInsertRowid),
      platform,
      type: 'post',
    };
  }

  /**
   * Generate a short caption with hashtags.
   * @param {string} topic - Caption topic
   * @param {boolean} [includeHashtags=true] - Whether to include hashtags
   * @returns {Promise<{content: string, id: number}>}
   */
  async generateCaption(topic, includeHashtags = true) {
    const hashtagInstruction = includeHashtags
      ? 'Include 5-8 relevant hashtags at the end.'
      : 'Do NOT include hashtags.';

    const prompt = `Write a short, engaging caption for a social media photo/post about: "${topic}".

Requirements:
- Keep it under 200 characters (excluding hashtags)
- Make it catchy and scroll-stopping
- ${hashtagInstruction}
- Use 1-2 emojis maximum

Return ONLY the caption, no explanations.`;

    const content = await this.think(prompt, { temperature: 0.9 });

    const result = this._contentStmts.insertContent.run(
      `Caption: ${topic}`,
      content,
      'caption',
      'all',
      this.name
    );

    return {
      content,
      id: Number(result.lastInsertRowid),
      type: 'caption',
    };
  }

  /**
   * Generate a long-form article or blog post.
   * @param {string} topic - Article topic
   * @param {string} [length='medium'] - 'short' (~300 words), 'medium' (~600), 'long' (~1000+)
   * @returns {Promise<{content: string, id: number}>}
   */
  async generateArticle(topic, length = 'medium') {
    const wordCounts = { short: 300, medium: 600, long: 1000 };
    const targetWords = wordCounts[length] || wordCounts.medium;

    const prompt = `Write a professional article/blog post about: "${topic}".

Requirements:
- Target length: approximately ${targetWords} words
- Include a compelling headline/title at the top
- Use clear section headers (##)
- Include practical insights, examples, or data points
- End with a conclusion and call-to-action
- Tone: professional but approachable
- Format in Markdown

Return the complete article.`;

    const content = await this.think(prompt, {
      temperature: 0.7,
      maxOutputTokens: 4096,
    });

    const result = this._contentStmts.insertContent.run(
      `Article: ${topic}`,
      content,
      'article',
      'all',
      this.name
    );

    return {
      content,
      id: Number(result.lastInsertRowid),
      type: 'article',
    };
  }

  /**
   * Suggest relevant hashtags for a topic.
   * @param {string} topic - The topic to generate hashtags for
   * @returns {Promise<{hashtags: string[], raw: string}>}
   */
  async suggestHashtags(topic) {
    const prompt = `Suggest 15-20 relevant hashtags for social media content about: "${topic}".

Requirements:
- Mix of popular (high volume) and niche (targeted) hashtags
- Include a branded hashtag suggestion
- Group them by category: Popular, Niche, Branded
- Format each hashtag with # prefix
- One hashtag per line within each group

Return ONLY the hashtag list grouped by category.`;

    const raw = await this.think(prompt, { temperature: 0.6 });

    // Extract hashtags from the response
    const hashtags = raw.match(/#\w+/g) || [];

    this.log('suggestHashtags', topic, `Generated ${hashtags.length} hashtags`, 'success');

    return {
      hashtags: [...new Set(hashtags)], // deduplicate
      raw,
    };
  }
}

// Export singleton instance
module.exports = new ContentCreator();
