class HallucinationGuard {
  inspect({ candidate = "", council = {}, evidence = [], state = {} }) {
    const flags = Array.isArray(council.hallucination_flags) ? council.hallucination_flags.slice() : []
    if (council.status === "UNCERTAIN" && !flags.includes("COUNCIL_UNCERTAIN")) flags.push("COUNCIL_UNCERTAIN")
    if (!evidence.length && /\b(?:verified|proven|certainly|always|never)\b/i.test(candidate)) flags.push("UNSUPPORTED_CERTAINTY")
    if (state.requiredText && !candidate.includes(state.requiredText)) flags.push("STATE_MISMATCH")
    return {
      alert: flags.length > 0,
      flags,
      status: flags.length ? "HALLUCINATION_ALERT" : "CLEAR",
      options: flags.length ? ["review_evidence", "ask_another_local_model", "retry", "cancel"] : ["continue"],
    }
  }
}

module.exports = { HallucinationGuard }
