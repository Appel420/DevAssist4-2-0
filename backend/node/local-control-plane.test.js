const request = require("node:http")
const app = require("./index")

describe("authorization-aware Shortcut route", () => {
  let server
  afterEach((done) => { if (server) server.close(done); else done() })
  function post(body, done) {
    server = app.listen(0, "127.0.0.1", () => { const address = server.address(); const encoded = JSON.stringify(body); const req = request.request({ host: "127.0.0.1", port: address.port, path: "/api/v1/shortcut/route", method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(encoded) } }, (res) => { let data = ""; res.on("data", (chunk) => { data += chunk }); res.on("end", () => done(res.statusCode, JSON.parse(data))) }); req.on("error", done); req.end(encoded) })
  }
  test("owner low-risk request is authorized", (done) => post({ text: "speak this", actor_type: "owner", capability: "speak_response" }, (status, value) => { try { expect(status).toBe(200); expect(value.authorization.decision).toBe("OWNER_AUTHORIZED"); expect(value.spoken_text).toBe(value.final_output); done() } catch (error) { done(error) } }))
  test("high-risk owner request requires confirmation", (done) => post({ text: "run this", actor_type: "owner", capability: "execute_local_command", risk_level: "high" }, (status, value) => { try { expect(status).toBe(409); expect(value.authorization.decision).toBe("CONFIRMATION_REQUIRED"); expect(value.authorization.checkpoint_id).toBeTruthy(); done() } catch (error) { done(error) } }))
  test("owner override is single-action and does not change policy", (done) => post({ text: "run this", actor_type: "owner", capability: "execute_local_command", risk_level: "high", confirmation: true, override: true }, (status, value) => { try { expect(status).toBe(200); expect(value.authorization.decision).toBe("OWNER_OVERRIDE"); expect(value.authorization.override_scope).toBe("single_action"); expect(value.authorization.policy_modified).toBe(false); done() } catch (error) { done(error) } }))
  test("model cannot override", (done) => post({ text: "speak", actor_type: "model", capability: "speak_response", override: true, confirmation: true }, (status, value) => { try { expect(status).toBe(403); expect(value.authorization.decision).toBe("ACCESS_DENIED"); done() } catch (error) { done(error) } }))
})
