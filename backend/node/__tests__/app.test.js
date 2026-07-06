const fs = require("fs")
const http = require("http")
const os = require("os")
const path = require("path")

const statePath = path.join(os.tmpdir(), `devassist-state-${process.pid}.json`)
process.env.DEVASSIST_STATE_PATH = statePath
process.env.DEVASSIST_STATE_SECRET = "devassist-test-secret"

const app = require("../index")

function request(method, pathname, payload) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address()
      const body = payload ? JSON.stringify(payload) : null

      const req = http.request(
        {
          host: "127.0.0.1",
          port,
          path: pathname,
          method,
          headers: body
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
              }
            : {},
        },
        (res) => {
          let data = ""
          res.setEncoding("utf8")
          res.on("data", (chunk) => {
            data += chunk
          })
          res.on("end", () => {
            server.close(() =>
              resolve({
                statusCode: res.statusCode,
                body: data ? JSON.parse(data) : null,
              }),
            )
          })
        },
      )

      req.on("error", (error) => {
        server.close(() => reject(error))
      })

      if (body) {
        req.write(body)
      }

      req.end()
    })
  })
}

describe("backend API", () => {
  afterAll(() => {
    if (fs.existsSync(statePath)) {
      fs.unlinkSync(statePath)
    }
  })

  test("serves health checks on versioned and legacy routes", async () => {
    const response = await request("GET", "/api/v1/health")

    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({
      status: "healthy",
      version: "4.2.0",
    })
  })

  test("accepts chat requests on the versioned route", async () => {
    const response = await request("POST", "/api/v1/chat", {
      message: "hello",
      deviceId: "550e8400-e29b-41d4-a716-446655440000",
      timestamp: Date.now(),
    })

    expect(response.statusCode).toBe(200)
    expect(response.body.message).toEqual(expect.any(String))
  })

  test("rejects invalid chat payloads", async () => {
    const response = await request("POST", "/api/v1/chat", {
      message: "",
    })

    expect(response.statusCode).toBe(400)
    expect(response.body.error).toBe("Validation failed")
  })

  test("returns the live security report", async () => {
    const response = await request("GET", "/api/v1/security/report")

    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({
      localOnly: true,
      runtimeMode: "offline",
      maxTokens: 2048,
    })
    expect(response.body.signature.algorithm).toBe("HMAC-SHA256")
  })

  test("protects memory deletion with a signature gate", async () => {
    const createResponse = await request("POST", "/api/v1/memory", {
      content: "owner note",
      kind: "text",
      author: "owner",
    })

    expect(createResponse.statusCode).toBe(201)
    const { id, signature } = createResponse.body.memory

    const denied = await request("DELETE", `/api/v1/memory/${id}`)
    expect(denied.statusCode).toBe(403)
    expect(denied.body.error).toMatch(/confirmation/i)

    const signed = await new Promise((resolve, reject) => {
      const server = app.listen(0, () => {
        const { port } = server.address()
        const body = null
        const req = http.request(
          {
            host: "127.0.0.1",
            port,
            path: `/api/v1/memory/${id}`,
            method: "DELETE",
            headers: {
              "X-DevAssist-Confirm-Delete": "true",
              "X-DevAssist-Delete-Signature": signature,
            },
          },
          (res) => {
            res.resume()
            res.on("end", () => {
              server.close(() =>
                resolve({
                  statusCode: res.statusCode,
                }),
              )
            })
          },
        )

        req.on("error", (error) => {
          server.close(() => reject(error))
        })

        if (body) {
          req.write(body)
        }

        req.end()
      })
    })

    expect(signed.statusCode).toBe(204)
  })
})
