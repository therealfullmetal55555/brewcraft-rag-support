# Portfolio Checklist — BrewCraft Care

## Screenshots to capture after setup

1. **`01-care-desk-desktop.png`** — Website at desktop width, showing the BrewCraft Care page, chat welcome, and topic cards. Keep the **Local preview** label visible unless the real webhook is connected.
2. **`02-care-desk-mobile.png`** — Responsive support page on a narrow viewport, including the chat composer and one message.
3. **`03-ingestion-canvas.png`** — `[RAG-01]` n8n canvas after a successful execution. Include the collection delete/create, splitter, embedding, and Qdrant insert path.
4. **`04-qdrant-payload.png`** — Qdrant collection details and one point's payload with a source document ID, filename, and content. Do not expose vectors or secrets unnecessarily.
5. **`05-grounded-answer.png`** — Telegram or connected website answer to a product-manual question, visibly showing the source ID. Use a question that is confirmed by your actual handbook.
6. **`06-human-handoff.png`** — Staff Telegram handoff showing the reason and latest conversation messages. Blur personal information and chat IDs in any public image.
7. **`07-security-and-audit.png`** — One prompt-injection refusal alongside the corresponding audit result (or show the workflow run and log separately). Do not claim the case passed unless you observed it.
8. **`08-error-handler.png`** — A controlled test failure demonstrating the selected global Error Workflow, error log row, and Telegram alert. Remove the artificial failure after the demo.

## 90-second demo video script

**0:00–0:12 | Problem and product**  
*Screen:* Open the desktop BrewCraft Care page.  
*Voiceover:* “Coffee-gear stores get a steady stream of the same shipping, returns, and product-care questions. A useful support tool needs to answer from the actual handbook—and hand off the cases it can’t answer.”

**0:12–0:25 | Show the customer experience**  
*Screen:* Use one of the quick questions, such as the TempFlow E2/descaling example.  
*Voiceover:* “This is BrewCraft Care: a deliberately simple, shop-style support page rather than a generic AI dashboard. The interface is mobile-friendly and shows where a response came from.”

**0:25–0:40 | Explain ingestion**  
*Screen:* Switch to the `[RAG-01]` workflow and then the Qdrant collection.  
*Voiceover:* “The knowledge base is nine short Markdown documents. The ingestion workflow splits them at a 600-character target with 100 characters of overlap, creates embeddings, and stores the document metadata in Qdrant. The overlap helps retain context at boundaries.”

**0:40–0:57 | Trace a grounded answer**  
*Screen:* Show `[RAG-02]` retrieval and the actual answer execution; point to the top-four search, prompt, and citation.  
*Voiceover:* “A customer question is embedded, matched against the four best chunks, and sent to the support model with those sources. The prompt requires a source citation and tells the model to abstain when the handbook doesn’t contain an answer.”

**0:57–1:12 | Human handoff and memory**  
*Screen:* Send a real unsupported question in your configured test chat; show its observed staff ticket and memory settings.  
*Voiceover:* “When confidence is low—or a customer asks for a person—the workflow routes the case to the staff chat and includes recent conversation history. Postgres keeps a six-message context window for follow-ups.”

**1:12–1:25 | Security and observability**  
*Screen:* Run one injection test and show the resulting refusal; then show audit/error logs.  
*Voiceover:* “The input filter, untrusted-message prompt boundary, restricted agent tools, and post-answer gate work together to resist common prompt-injection attempts. Audit events and workflow failures go to separate Sheets tabs.”

**1:25–1:30 | Close honestly**  
*Screen:* Return to the interface or README.  
*Voiceover:* “The test suite is included with expected behavior. I report live pass rates only after each case has been run against the configured workflows.”

> Replace every screen action above with an actual execution from your own n8n setup. The site’s default local preview is deterministic and offline; do not describe it as a live Gemini response.
