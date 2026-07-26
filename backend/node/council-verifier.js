const crypto = require("crypto")

function hash(value) { return crypto.createHash("sha3-512").update(JSON.stringify(value), "utf8").digest("hex") }

class CouncilVerifier {
  verify({ responses = [], candidate = "", expected = {} }) {
    const normalized = responses.filter((item) => item && typeof item.text === "string")
    const texts = normalized.map((item) => item.text.trim())
    const unique = new Set(texts)
    const disagreement = unique.size > 1
    const unsupported = expected.requiredClaims ? expected.requiredClaims.filter((claim) => !candidate.includes(claim)) : []
    const hallucinationFlags = []
    if (disagreement) hallucinationFlags.push("COUNCIL_DISAGREEMENT")
    if (unsupported.length) hallucinationFlags.push("UNSUPPORTED_REQUIRED_CLAIMS")
    return {
      agreement_score: normalized.length ? (unique.size === 1 ? 1 : 1 / unique.size) : 0,
      disagreement_points: disagreement ? ["candidate responses differ"] : [],
      hallucination_flags: hallucinationFlags,
      evidence_hash: hash({ responses: normalized, candidate }),
      status: hallucinationFlags.length ? "UNCERTAIN" : "SUPPORTED",
    }
  }
}

module.exports = { CouncilVerifier }
