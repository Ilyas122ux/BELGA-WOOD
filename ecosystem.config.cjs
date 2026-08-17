module.exports = {
  apps: [{
    name: 'jad-home',
    cwd: __dirname,
    script: 'server/dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '700M',
    env: {
      NODE_ENV: 'production',
      PORT: 4000,
    },
  }],
};
