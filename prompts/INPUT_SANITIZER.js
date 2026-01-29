// Normalize Input & Injection Pre-Filter node
// Full authoritative version is embedded in workflows/02_telegram_rag_support_assistant.json
const payload = $input.item.json;
const isWebhook = Boolean(payload.body && payload.body.message !== undefined);
const msg = payload.message || {};

const sourceChannel = isWebhook ? 'web_widget' : 'telegram';
const chatId = isWebhook
  ? String(payload.body.session_id || 'web_guest_01')
  : String(msg.chat?.id || 'unknown');
const userName = isWebhook
  ? String(payload.body.user_name || 'Web Visitor')
  : ([msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || msg.from?.username || 'Customer');
const rawText = isWebhook
  ? String(payload.body.message || '').trim()
  : (msg.text || '').trim();

const sanitizedText = rawText.slice(0, 1000);

const injectionPatterns = [
  /ignore\s+(all\s+)?(previous|prior|above|system)\s+(instructions|prompts|rules)/i,
  /disregard\s+(all\s+)?(previous|prior|system)\s+(instructions|prompts|rules)/i,
  /you\s+are\s+now\s+(dan|in\s+developer\s+mode|unrestricted|a\s+different)/i,
  /(reveal|print|show|output|repeat)\s+(your|the)\s+(system\s+prompt|hidden\s+instructions|initial\s+prompt)/i,
  /<\s*\/?\s*(system|instruction|retrieved_context|untrusted_customer_message)\s*>/i,
  /system\s*override|admin\s*override|sudo\s+mode/i
];

const injectionDetected = injectionPatterns.some(regex => regex.test(sanitizedText));
const humanRequestPatterns = /\b(human|real person|live agent|support agent|manager|representative|talk to someone|escalate)\b/i;
const explicitHumanRequest = humanRequestPatterns.test(sanitizedText);

return {
  json: {
    source_channel: sourceChannel,
    chat_id: chatId,
    session_id: `${sourceChannel}_${chatId}`,
    user_name: userName,
    username_handle: isWebhook ? 'web-session' : (msg.from?.username ? `@${msg.from.username}` : 'N/A'),
    user_message: sanitizedText,
    is_empty_or_non_text: sanitizedText.length === 0,
    injection_detected: injectionDetected,
    explicit_human_request: explicitHumanRequest,
    received_at: new Date().toISOString()
  }
};
