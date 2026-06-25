export const config = {
  app: {
    name: "DevAssist 4.2.0",
    mode: "local-only",
  },
  chat: {
    maxTokens: 4096,
    maxHistory: 20,
    maxMessageLength: 2000,
  },
  runtime: {
    apiBasePath: "/api",
    storage: "memory",
  },
}
