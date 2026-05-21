// PM2 Ecosystem Configuration
module.exports = {
  apps: [
    {
      name: 'commandcenter-ai',
      script: './server/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
    },
  ],
};
