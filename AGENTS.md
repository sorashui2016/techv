<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project Memory

This project is a Chinese “科技选题雷达” system for tech/digital content creators. The first-stage MVP focuses on a stable monitoring dashboard: configure monitored sources, run scheduled checks by source tier, ingest and deduplicate new videos, translate titles, generate <=100 Chinese-character summaries, score items, show them as dashboard cards, support decision states, and reserve hooks for research and Feishu push.

Before making product or implementation changes, read `docs/PROJECT_CONTEXT.md`. It contains the recovered product context from the user's SPEC v3.0, later decisions, and current known implementation gaps. Treat that file as project memory and update it whenever important requirements or decisions change.

Current phase: stage 1 plus the first version of the exploration radar. Do not build the full stage-2 research system or stage-3 material/script production unless the user explicitly asks. Real Feishu webhook push for important-account new videos has been implemented at the user's request; exploration radar Feishu push is still deferred.

The “平台探索雷达 / 科技发现流” module is separate from the existing configured-account monitoring flow. Read the dedicated section in `docs/PROJECT_CONTEXT.md` first; the first version is YouTube-only, has independent exploration candidates/statuses, and should not push Feishu yet. Main routes are `/explore`, `/explore/next`, and `/explore/rules`; command-line manual run is `npm.cmd run explore`.
