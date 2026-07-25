const request = require("node:http")
const app = require("./index")

describe("local Shortcut control plane", () => {
  let server

  afterEach((done) => {
    if (server) server.close(done)
    else done()
  })

  test("returns a local response with ML-DSA-87 metadata", (done) => {
    server = app.listen(0, "127.0.0.1", () => {
      const address = server.address()
      const body = JSON.stringify({
        text: "hello from Shortcut",
        context: { source: "ios-shortcut", spoken: true },
        routing: { mode: "heavy-controller", use_judge: true },
      })
      const req = request.request({
        host: "127.0.0.1",
        port: address.port,
        path: "/api/v1/shortcut/route",
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      }, (res) => {
        let data = ""
        res.on("data", (chunk) => { data += chunk })
        res.on("end", () => {
          try {
            expect(res.statusCode).toBe(200)
            const value = JSON.parse(data)
            expect(value.status).toBe("completed")
            expect(value.spoken_text).toBe(value.final_output)
            expect(value.routing.network_accessed).toBe(false)
            expect(value.verdict.algorithm).toBe("ML-DSA-87")
            expect(value.verdict.signature_status).toBe("unavailable")
            expect(JSON.stringify(value)).not.toContain("ML-DSA-65")
            done()
          } catch (error) { done(error) }
        })
      })
      req.on("error", done)
      req.end(body)
    })
  })

  test("rejects remote URLs", (done) => {
    server = app.listen(0, "127.0.0.1", () => {
      const address = server.address()
      const body = JSON.stringify({ text: "use https://example.com" })
      const req = request.request({
        host: "127.0.0.1",
        port: address.port,
        path: "/api/v1/shortcut/route",
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      }, (res) => {
        res.resume()
        res.on("end", () => {
          try { expect(res.statusCode).toBe(400); done() } catch (error) { done(error) }
        })
      })
      req.on("error", done)
      req.end(body)
    })
  })
})
