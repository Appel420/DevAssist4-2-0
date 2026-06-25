export const config = {
  app: {
    name: "DevAssist 4.2.0",
    mode: "local-only",
  },
  chat: {
    maxTokens: 1000,
    maxHistory: 10,
    maxMessageLength: 1000,
  },
  runtime: {
    apiBasePath: "/api",
    storage: "memory",
  },
}
