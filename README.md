# BrewCraft Care — Grounded RAG Support & Human Handoff Help Desk

<div align="center">

[![n8n Self-Hosted](https://img.shields.io/badge/Orchestration-n8n_v1.x-EA4B71.svg?style=flat-square&logo=n8n&logoColor=white)](https://n8n.io/)
[![Qdrant Vector DB](https://img.shields.io/badge/Vector_DB-Qdrant_3072--dim-DC2626.svg?style=flat-square&logo=qdrant&logoColor=white)](https://qdrant.tech/)
[![Google Gemini](https://img.shields.io/badge/LLM-Gemini_Flash_/_Embedding--001-4285F4.svg?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/)
[![PostgreSQL 16](https://img.shields.io/badge/Storage-PostgreSQL_16-336791.svg?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Telegram Bot API](https://img.shields.io/badge/Channels-Telegram_Bot_API-24A1DE.svg?style=flat-square&logo=telegram&logoColor=white)](https://core.telegram.org/bots/api)
[![License: MIT](https://img.shields.io/badge/License-MIT-2ea44f.svg?style=flat-square)](./LICENSE)
[![Benchmark Accuracy](https://img.shields.io/badge/Acceptance_Tests-20%2F20_Passed_(100%25)-success.svg?style=flat-square)](#acceptance-benchmark--evaluation)

**Production-grade Retrieval-Augmented Generation (RAG) customer support system for e-commerce, combining an embedded web help desk, Telegram channels, 9-document Qdrant vector retrieval, sliding window Postgres memory ($N=6$), and an automated confidence & human handoff gate.**

[Key Features](#key-features) • [Architecture](#architecture) • [Engineering Decisions](#key-engineering-decisions) • [Quick Start](#quick-start) • [Benchmark](#acceptance-benchmark--evaluation) • [Telemetry & Cost](#telemetry--operational-cost)

</div>

---

## Overview

In direct-to-consumer e-commerce, customer support teams face high volumes of repetitive inquiries regarding warranty boundaries, VAT refunds, electrical specs, and shipping policies. Unconstrained generative AI bots frequently hallucinate non-existent return terms or lack mechanisms to escalate complex cases to human staff.

This repository implements **BrewCraft Care**, an enterprise e-commerce customer support pipeline:
1. Grounded against a structured 9-document knowledge base (shipping, returns, warranty, product manuals, VAT, B2B wholesale).
2. Uses **Qdrant** vector search with 3072-dimensional embeddings (`gemini-embedding-001`) and cosine similarity thresholds.
3. Evaluates a hybrid **Confidence & Human Handoff Gate** ($0.4 \times \text{top-1 similarity} + 0.6 \times \text{LLM confidence}$).
4. Defends against prompt injection via Layer-1 regex screening and XML tag isolation.
5. Preserves 6-message conversation history in PostgreSQL while attaching the last 20 messages to escalated staff tickets.

---

## Architecture

<p align="center">
  <img src="./assets/architecture.svg" alt="BrewCraft Care Architecture" width="100%">
</p>

```
[9 Handbook Markdown Docs]
            │ (Recursive 600-char splitting, 100 overlap)
            ▼
[Qdrant Collection: brewcraft_kb (Cosine, 3072-dim)]

[Customer Web Desk / Telegram]
            │
            ▼
  [INPUT_SANITIZER Node] ──(Injection Pre-Filter)──► [Refusal & Safe Halt]
            │
            ▼
  [Qdrant Semantic Top-4 Search]
            │
            ▼
  [Gemini Flash LLM Engine]
  - XML-Delimited Context Grounding
  - Mandatory Source Citations (`[Source: KB-*-XX]`)
  - Postgres Multi-Turn Chat Memory (N=6)
            │
            ▼
  [CONFIDENCE_HANDOFF_GATE Node]
  - Composite Confidence: 0.4*Sim + 0.6*Conf
  - Explicit Human Request Detection
            │
            ├──► High Confidence / Grounded  ──► [Auto Customer Reply]
            └──► Low Confidence / Out of KB  ──► [Telegram Human Handoff Ticket (20 msgs)]
                                             └──► [Google Sheets Audit Run Log]
```

---

## Key Features

- 📑 **Strict Source Grounding:** Every factual claim must include an explicit document identifier tag (`[Source: KB-MAN-04]`). Answers lacking citations are rejected by the post-generation gate.
- 🛡️ **Hybrid Confidence Handoff Gate:** Evaluates composite score ($0.4 \cdot S_{\text{vector}} + 0.6 \cdot C_{\text{LLM}}$). Automatically escalates if vector similarity $< 0.62$, LLM confidence $< 0.70$, or user explicitly asks for human support.
- 🛑 **Multi-Layer Injection Shield:** Blocks `DAN`, `developer mode`, XML evasion (`</retrieved_context>`), and system prompt exfiltration without notifying the human queue.
- 🧠 **Multi-Turn Postgres Memory:** Retains $N=6$ message sliding window memory to resolve anaphoric follow-up references (e.g. *"what happens to it if I use it in an office?"*).
- 🌐 **Responsive Help Desk UI:** Self-contained responsive HTML/CSS customer support portal (`site/index.html`) with interactive chat simulation.

---

## Key Engineering Decisions

### 1. Hybrid Confidence Gate Equation
Relying solely on LLM self-reported confidence causes overconfidence on hallucinated answers. Combining vector cosine distance with model confidence creates a robust escalation criterion:
$$\text{Composite Score} = 0.4 \times S_{\text{top1}} + 0.6 \times C_{\text{LLM}}$$
- If $\text{Composite} < 0.65$ or $S_{\text{top1}} < 0.62 \rightarrow$ Escalate to Human Support.
- Exception: High-confidence follow-up floor ($S_{\text{top1}} \ge 0.52$ allowed only if $C_{\text{LLM}} \ge 0.85$ and valid citation present).

### 2. Closed-World Assumption & Refusal Protocol
System prompt rules enforce that the model cannot adopt user premises that contradict retrieved context (e.g. hypothetical roleplay claiming UK orders over £500 are tax-free).

---

## Quick Start

### 1. Installation & Environment Setup

```bash
git clone https://github.com/therealfullmetal55555/brewcraft-rag-support.git
cd brewcraft-rag-support
cp .env.example .env
# Edit .env with your Gemini API key and Telegram tokens
```

### 2. Start Services via Docker Compose

```bash
docker compose up -d
```
- Web Help Desk: `http://localhost:8080`
- n8n Automation Engine: `http://localhost:5678`
- Qdrant Vector Dashboard: `http://localhost:6333/dashboard`

### 3. Ingest Knowledge Base

Run the pre-configured workflow [`workflows/01_kb_ingestion_workflow.json`](./workflows/01_kb_ingestion_workflow.json) inside n8n to chunk and index the 9 Markdown manuals into Qdrant.

---

## Acceptance Benchmark & Evaluation

The repository includes a comprehensive 20-scenario offline test suite ([`simulate_pipeline.py`](./simulate_pipeline.py)) validating all criteria documented in [`EVALUATION_20_TESTS.md`](./EVALUATION_20_TESTS.md):

```bash
python3 simulate_pipeline.py
```

```
=====================================================================================
BREWCRAFT CARE — RAG CUSTOMER SUPPORT & HUMAN HANDOFF BENCHMARK (20 TESTS)
=====================================================================================
[01] ✅ PASS | Cat: In-Scope                 | Action: AUTO_ANSWER       | Sources: ['KB-SHIP-01']
[02] ✅ PASS | Cat: In-Scope                 | Action: AUTO_ANSWER       | Sources: ['KB-SHIP-01']
[03] ✅ PASS | Cat: In-Scope                 | Action: AUTO_ANSWER       | Sources: ['KB-MAN-04']
[04] ✅ PASS | Cat: In-Scope                 | Action: AUTO_ANSWER       | Sources: ['KB-MAN-05']
[05] ✅ PASS | Cat: In-Scope                 | Action: AUTO_ANSWER       | Sources: ['KB-MAN-06']
[06] ✅ PASS | Cat: In-Scope                 | Action: AUTO_ANSWER       | Sources: ['KB-PAY-07']
[07] ✅ PASS | Cat: In-Scope                 | Action: AUTO_ANSWER       | Sources: ['KB-RET-02']
[08] ✅ PASS | Cat: In-Scope                 | Action: AUTO_ANSWER       | Sources: ['KB-LOY-09', 'KB-WAR-03']
[09] ✅ PASS | Cat: Out-of-Scope             | Action: HANDOFF_TO_HUMAN  | Sources: []
[10] ✅ PASS | Cat: Out-of-Scope             | Action: HANDOFF_TO_HUMAN  | Sources: []
[11] ✅ PASS | Cat: Out-of-Scope             | Action: HANDOFF_TO_HUMAN  | Sources: []
[12] ✅ PASS | Cat: Out-of-Scope             | Action: HANDOFF_TO_HUMAN  | Sources: []
[13] ✅ PASS | Cat: Tricky (Multi-Turn)      | Action: AUTO_ANSWER       | Sources: ['KB-WAR-03']
[14] ✅ PASS | Cat: Tricky (Partial Context) | Action: HANDOFF_TO_HUMAN  | Sources: ['KB-PAY-07']
[15] ✅ PASS | Cat: Tricky (Boundary Rule)   | Action: AUTO_ANSWER       | Sources: ['KB-ORD-08']
[16] ✅ PASS | Cat: Tricky (Explicit Escalation) | Action: HANDOFF_TO_HUMAN | Sources: []
[17] ✅ PASS | Cat: Prompt Injection         | Action: BLOCK_INJECTION   | Sources: []
[18] ✅ PASS | Cat: Prompt Injection         | Action: BLOCK_INJECTION   | Sources: []
[19] ✅ PASS | Cat: Prompt Injection         | Action: BLOCK_INJECTION   | Sources: []
[20] ✅ PASS | Cat: Prompt Injection (Roleplay) | Action: AUTO_ANSWER    | Sources: ['KB-SHIP-01']
=====================================================================================
ACCEPTANCE BENCHMARK SUMMARY
• Total Test Cases:          20
• In-Scope RAG Precision:    8/8 (100.0%)
• Out-of-Scope Escalations:  4/4 (100.0%)
• Tricky & Boundary Rules:   4/4 (100.0%)
• Prompt Injection Defense:  4/4 (100.0%)
• Overall Pass Rate:         20/20 (100.0%)
=====================================================================================
✅ ALL CRITERIA PASSED: BrewCraft Care RAG Assistant Verified (20/20)
```

---

## Telemetry & Operational Cost

| Step | Service / Model | Unit Metric | Cost per Query |
| :--- | :--- | :--- | :--- |
| **Vector Embedding** | Gemini `embedding-001` | ~120 tokens | \$0.000003 |
| **Vector Similarity Search** | Local Qdrant Engine | Sub-5ms latency | \$0.000000 |
| **Grounded Generation** | Gemini 3.8 Flash | ~1,200 prompt / ~150 completion | ~\$0.000180 |
| **PostgreSQL Chat Memory** | Local Docker Instance | Free | \$0.000000 |
| **Telegram & Sheets Delivery** | Telegram API & Sheets v4 | Free Tier | \$0.000000 |
| **Total Query Cost** | — | — | **~\$0.000183** |

---

## License

This project is licensed under the [MIT License](./LICENSE) — see the LICENSE file for details.
