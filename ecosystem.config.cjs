module.exports = {
  apps: [
    {
      name: "turkchain-ui",
      cwd: "/root/turkchain-dex-ui/apps/web",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: "3019"
      }
    }
  ]
};
