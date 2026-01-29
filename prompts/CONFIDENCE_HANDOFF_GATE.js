// Evaluate Confidence & Handoff Gate node
// Full authoritative version is embedded in workflows/02_telegram_rag_support_assistant.json
const telemetry = $('Format Retrieved Context & Similarity Metrics').item.json;
const llmOut = $input.item.json.output || $input.item.json;

const top1Sim = Number(telemetry.top1_similarity || 0);
const llmConf = Number(llmOut.llm_confidence ?? 0);
const citedDocs = Array.isArray(llmOut.cited_documents) ? llmOut.cited_documents : [];
const validCitations = citedDocs.filter(id => /^KB-[A-Z]+-\d+$/.test(id));

const compositeConfidence = Number(((top1Sim * 0.4) + (llmConf * 0.6)).toFixed(3));

// 1. Check Prompt Injection Gate First (Block without spamming human agents)
if (telemetry.injection_detected || llmOut.handoff_reason === 'PROMPT_INJECTION_ATTEMPT') {
  return {
    json: {
      ...telemetry,
      llm_confidence: 0.0,
      composite_confidence: 0.0,
      cited_documents: [],
      final_action: 'BLOCK_INJECTION',
      trigger_human_handoff: false,
      escalation_reason: 'PROMPT_INJECTION_BLOCKED',
      customer_reply: 'I can only assist with questions covered by the official BrewCraft Coffee Gear knowledge base.'
    }
  };
}

// 2. Hybrid Confidence & Human Handoff Gate
const SIMILARITY_THRESHOLD = 0.62;
const FOLLOWUP_SIMILARITY_FLOOR = 0.52;
const LLM_CONFIDENCE_THRESHOLD = 0.70;

const isHighConfidenceFollowUp = (top1Sim >= FOLLOWUP_SIMILARITY_FLOOR && llmConf >= 0.85 && validCitations.length > 0);
const lowVectorSimilarity = (top1Sim < SIMILARITY_THRESHOLD) && !isHighConfidenceFollowUp;
const lowLlmConfidence = llmConf < LLM_CONFIDENCE_THRESHOLD;
const missingValidCitation = validCitations.length === 0;

const shouldHandoff =
  telemetry.explicit_human_request ||
  Boolean(llmOut.needs_human_handoff) ||
  lowVectorSimilarity ||
  lowLlmConfidence ||
  missingValidCitation;

let escalationReason = 'NONE';
if (shouldHandoff) {
  if (telemetry.explicit_human_request || llmOut.handoff_reason === 'USER_REQUESTED_HUMAN') {
    escalationReason = 'USER_REQUESTED_HUMAN';
  } else if (lowVectorSimilarity) {
    escalationReason = `LOW_VECTOR_SIMILARITY (${top1Sim} < ${SIMILARITY_THRESHOLD})`;
  } else if (llmOut.needs_human_handoff || lowLlmConfidence) {
    escalationReason = `INSUFFICIENT_CONTEXT_OR_CONFIDENCE (llm_conf=${llmConf})`;
  } else if (missingValidCitation) {
    escalationReason = 'MISSING_SOURCE_CITATION';
  }
}

let finalReply = llmOut.answer || '';
if (shouldHandoff) {
  // Preserve partial grounded answer if it has valid citations, otherwise use standard fallback
  if (validCitations.length > 0 && finalReply && !finalReply.toLowerCase().includes("i don't know")) {
    finalReply = `${finalReply}\n\n🔔 *Human Handoff:* For the remaining details not covered in our knowledge base, I have forwarded your full conversation to a human support specialist.`;
  } else {
    finalReply = "I don't know based on our official BrewCraft knowledge base. I have escalated your full conversation to a human support specialist who will follow up with you shortly.";
  }
}

return {
  json: {
    ...telemetry,
    llm_confidence: llmConf,
    composite_confidence: compositeConfidence,
    cited_documents: validCitations,
    final_action: shouldHandoff ? 'HANDOFF_TO_HUMAN' : 'AUTO_ANSWER',
    trigger_human_handoff: shouldHandoff,
    escalation_reason: escalationReason,
    customer_reply: finalReply
  }
};
