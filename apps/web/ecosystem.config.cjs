module.exports = {
  apps: [
    {
      name: "turkchain-ui",
      cwd: "/root/turkchain-dex-ui/apps/web",
      script: "bun",
      args: "run start",
      env: {
        HOSTNAME: "0.0.0.0",
        PORT: "3019",
        NODE_ENV: "production"
      }
    }
  ]
};
