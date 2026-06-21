---
"@sip-protocol/sdk": patch
---

Migrate `@langchain/core` (0.3 → 1.x) and `@langchain/openai` (0.6 → 1.x) to v1. LangChain 1.0 made `SystemMessage`/`HumanMessage`/`AIMessage` non-interchangeable (each now carries invariant `MessageStructure<MessageToolSet>` generics), so the Privacy Advisor's message arrays are explicitly typed as `BaseMessage[]`. No public API or runtime behavior change.
