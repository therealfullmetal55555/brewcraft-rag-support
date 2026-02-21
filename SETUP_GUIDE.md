# Setup Guide — BrewCraft Care RAG Project

This guide takes you from a fresh checkout to an operational test. The web page also runs in a local preview without any credentials.

## A. What you need
- Docker Desktop or Docker Engine + the Docker Compose plugin.
- A Google AI Studio / Gemini API key with access to `gemini-embedding-001` and `gemini-3.8-flash`.
- A Telegram bot token from `@BotFather`, a customer test chat, and a separate staff-support group/channel where the bot can post.
- A Google Sheet with two tabs: `audit_logs` and `error_logs`.
- An n8n instance with the workflow nodes/packages used by the exports. The AI/LangChain nodes are included in current n8n builds; confirm node versions after import.

**Cost:** n8n, PostgreSQL, Qdrant, and the website are self-hosted/free software. Gemini API availability and quota depend on current account, region, and Google terms; check current pricing before production. Telegram's bot API is free. Hosting, a domain, and internet access can cost money.

## B. Configure the local stack
From the project root:

```bash
cp .env.example .env
```
Open `.env` and set every placeholder:

| Variable | Value |
|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Local database values; use a strong password. |
| `N8N_ENCRYPTION_KEY` | A long, random, private value. Keep it stable; changing it can make stored n8n credentials unreadable. |
| `GEMINI_API_KEY` | Your Gemini API key. |
| `ALERT_TELEGRAM_CHAT_ID` | Chat ID for operational error alerts. |
| `SUPPORT_TEAM_TELEGRAM_CHAT_ID` | Staff handoff group/channel ID, often a negative number. |
| `ERROR_LOG_SPREADSHEET_ID` | The Google spreadsheet ID containing the two log tabs. |

Never commit `.env`, API keys, bot tokens, or customer data. The `.env.example` file contains placeholders only.

Start containers:

```bash
docker compose up -d
docker compose ps
```
Visit n8n at `http://localhost:5678` and Qdrant at `http://localhost:6333/dashboard`.

## C. Prepare Google Sheets and n8n credentials
Create spreadsheet tabs with these header rows (row 1):

**`audit_logs`**
```text
timestamp | workflow_name | execution_id | event_type | entity_id | status | details
```
**`error_logs`**
```text
timestamp | workflow_name | execution_id | failed_node | error_message | execution_url
```

In n8n, create/select credentials for:
1. Google Gemini (for the `Google Gemini Chat Model` and `Embeddings Google Gemini` nodes).
2. Telegram Bot API (customer replies and human/error alerts).
3. PostgreSQL (`postgres:5432`; database, user and password from `.env`). Use the same database as the n8n compose stack for chat memory.
4. Google Sheets OAuth/service-account credentials with edit access to the spreadsheet.

The direct query-embedding HTTP Request node reads `GEMINI_API_KEY` from the n8n environment. In the Compose file, keep that environment variable set. Do not paste any secret into a workflow node or frontend JavaScript.

## D. Import and attach the workflows
In n8n, import these JSON exports in this order:

1. `workflows/00_global_error_handler.json` — choose Telegram and Sheets credentials. Activate it. In **each** main workflow's Settings, select this workflow under **Error Workflow** and save.
2. `workflows/01_kb_ingestion_workflow.json` — choose Gemini and Sheets credentials. The Compose mount makes docs available at `/files/knowledge_base/`. Check that the Google Sheet ID expression resolves from the environment.
3. `workflows/02_telegram_rag_support_assistant.json` — choose Telegram credentials for both Telegram nodes; Gemini credentials for the chat model and ingestion embeddings; Postgres credentials for chat memory/query; and Google Sheets credentials for the audit node.

Workflow node names and layout can vary slightly between n8n releases. After import, inspect each credential selector and any red/error-marked node rather than assuming exported credentials are present. Node retries are configured on network/API operations. The central Error Trigger logs and alerts when it is selected as the error workflow.

### Ingestion settings
- Collection: `brewcraft_kb`.
- Distance: Cosine.
- Vector size: 3072. This matches the current default output dimension of `gemini-embedding-001` used by the exported embedding node and query call.
- Splitter: `Recursive Character Text Splitter`, `chunkSize=600`, `chunkOverlap=100` (characters). The chunk size keeps most short policy sections together, while overlap carries boundary text into the next chunk. For longer source paragraphs the splitter can split mid-section; inspect chunks and adjust after testing retrieval.
- The workflow deletes and recreates this collection before indexing. It is a full reindex, not an incremental update. The delete node is set to continue past a first-run 404; a later create error should still fail and surface in the execution.

Run `[RAG-01] Knowledge Base Ingestion to Qdrant` once manually. Confirm the run completes, `brewcraft_kb` exists, and points have payload fields for content/metadata. Then test a few searches before activating customer support.

### Support workflow settings
- Query vector search: top 4 results.
- Memory: Postgres Chat Memory table `n8n_chat_histories`, session key `telegram_<chat id>` or `web_widget_<session id>`, context window `6`.
- Staff handoff: fetches up to the latest 20 stored message rows, formats them into a ticket, and sends it to `SUPPORT_TEAM_TELEGRAM_CHAT_ID`.
- Confidence gate: composite = `0.4 × top1_similarity + 0.6 × llm_confidence`; auto-answer otherwise requires a valid citation, confidence at least `0.70`, and similarity normally at least `0.62`. For memory follow-ups only, the similarity floor can be `0.52` when LLM confidence is at least `0.85` and citations are present. An explicit human request or the model's handoff flag also escalates. Prompt injection is refused without human alert spam.
- A hardcoded allow-list of cited document IDs should be considered before production. The current gate checks the citation ID shape; it does not independently verify every generated citation against retrieved chunks.

Activate `[RAG-02]` only after one successful ingestion and one supported manual test. The Telegram trigger requires a real bot credential and active Telegram workflow.

## E. Connect the website
Run the static page locally:

```bash
cd site
python3 -m http.server 4173 --bind 0.0.0.0
```
Open `http://localhost:4173`. The default interface is **Local preview** mode and does not call an LLM. Click the small settings/gear button in the support card, then enter the n8n **production webhook URL** (not the test URL). Save. The browser sends a form-urlencoded POST with `message`, `session_id`, and `user_name`.

The webhook URL is saved in that browser's local storage. A URL parameter can also be used for a one-off test: `?webhook=https://your-host/webhook/brewcraft-rag`.

**CORS:** The exported webhook is permissive to make first-time preview wiring easier. Change it to the exact storefront origin before deployment. Use HTTPS, rate-limit requests, protect staff IDs and operational logs, and never put Gemini/Telegram credentials in the browser. The webhook must return JSON containing `customer_reply` or `answer`.

## F. Run the acceptance tests honestly
1. Use the questions in `EVALUATION_20_TESTS.md` after both workflows are configured.
2. Test Telegram and website separately. Include one two-turn conversation to verify memory.
3. For each run, capture the execution ID, retrieved similarity, source document(s), chosen route, and whether the expected handoff alert was delivered.
4. Mark the result only after observing it. Scores shown in older drafts were illustrative and have been removed; do not report them as measured results.
5. Check the injection tests do not cause a human alert and that unknown live-order queries abstain instead of inventing a status.

## G. Troubleshooting
- **Qdrant rejects vector dimensions:** delete the collection and rerun ingestion; both embedding paths must emit 3072 values. Do not mix embeddings from different model/dimension settings in one collection.
- **No documents appear:** confirm the Docker mount, that `.md` files exist, and that the `Read KB Markdown Files` node sees nine files.
- **Gemini 404 / model unavailable:** confirm API access and the exact model ID in the current Google documentation, then update both ingestion and query embedding paths together. Recreate the Qdrant collection after changing dimensions/model family.
- **No staff alert:** verify the bot has permission to post in the group, the correct negative chat ID, and the Telegram credential selected on the human-notify node.
- **No website answer:** use the production webhook URL, activate the workflow, confirm CORS permits the page's origin, and inspect the n8n execution. If the webhook is not configured, the page uses the explicitly marked local preview instead.
- **Error sheet or alert missing:** select `[CORE] Global Error Handler` in the workflow's Error Workflow setting and verify the matching Sheets tab headers and credentials.
