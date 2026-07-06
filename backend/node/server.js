#!/usr/bin/env node

const app = require("./index")

const HOST = process.env.HOST || "127.0.0.1"
const PORT = Number(process.env.PORT || process.env.BRIDGE_PORT) || 0

const server = app.listen(PORT, HOST, () => {
  const address = server.address()
  const actualPort = typeof address === "object" && address ? address.port : PORT
  console.log(`🚀 DevAssist API server running on ${HOST}:${actualPort}`)
})
