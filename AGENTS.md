<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project Memory

This project is a Chinese "科技选题雷达" system for tech/digital content creators. The first-stage MVP focuses on a stable monitoring dashboard: configure monitored sources, run scheduled checks by source tier, ingest and deduplicate new videos, translate titles, generate <=100 Chinese-character summaries, score items, show them as dashboard cards, support decision states, and reserve hooks for research and Feishu push.

Before making product or implementation changes, read `docs/PROJECT_CONTEXT.md`. It contains the recovered product context from the user's SPEC v3.0 and the current known implementation gaps. Treat that file as project memory and update it whenever important requirements or decisions change.

Current phase: stage 1 only. Do not build the full stage-2 research system, stage-3 material/script production, or real Feishu push unless the user explicitly asks. Keep architecture ready for those later stages.
