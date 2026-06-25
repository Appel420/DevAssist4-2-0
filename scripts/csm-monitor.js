#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const http = require("http")

const root = path.resolve(__dirname, "..")
const banned = [
  /google/i,
  /firebase/i,
  /vertex/i,
  /vercel/i,
  /ollama/i,
  /llama/i,
  /facebook/i,
  /instagram/i,
  /messenger/i,
  /openai/i,
  /gemini/i,
  /meta\.com/i,
]

const ignore = new Set(["node_modules", ".git", ".next", "dist", "build", "coverage"])

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignore.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (full !== __filename && /\.(js|ts|tsx|json|md|swift|css|yaml|yml|py|plist)$/i.test(entry.name)) out.push(full)
  }
  return out
}

function scan() {
  const matches = []
  for (const file of walk(root)) {
    const text = fs.readFileSync(file, "utf8")
    for (const term of banned) {
      if (term.test(text)) {
        matches.push(`${path.relative(root, file)}:${term}`)
      }
    }
  }
  return matches
}

function check(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume()
      resolve(res.statusCode === 200)
    })
    req.on("error", () => resolve(false))
    req.setTimeout(3000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

async function main() {
  const intervalMs = Number(process.env.CSM_INTERVAL_MS || 60000)
  console.log("[CSM] local monitor started")

  const tick = async () => {
    const findings = scan()
    if (findings.length) {
      console.log("[CSM] banned references detected")
      for (const finding of findings.slice(0, 20)) console.log(`[CSM] ${finding}`)
    } else {
      console.log("[CSM] reference scan clean")
    }

    const healthy = await check(process.env.CSM_HEALTH_URL || "http://127.0.0.1:3000/api/v1/health")
    console.log(healthy ? "[CSM] health ok" : "[CSM] health offline")
  }

  await tick()
  setInterval(tick, intervalMs)
}

main().catch((error) => {
  console.error("[CSM] fatal", error)
  process.exit(1)
})
