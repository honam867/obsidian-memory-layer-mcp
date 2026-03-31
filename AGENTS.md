# Obsidian Memory Layer — Agent Instructions

You have access to a **long-term memory system** via MCP tools. This memory persists across sessions — use it to remember what you've done, what you've learned, and what comes next.

## Rules

### Session Start (MANDATORY)

When the user mentions a project name or starts working:

1. Call `session_start` with the project name
2. Read the returned context carefully — it contains:
   - Project description and tech stack
   - Current progress (what's done, what's in progress)
   - Open TODOs
   - Recent session summaries
3. Briefly tell the user what you remember, and ask what to work on

### During Work

Save memories **as they happen**, not in bulk at the end:

| Trigger | Action |
|---------|--------|
| Made an architecture or tech decision | `memory_save` type=`decision` |
| Found a bug fix, workaround, or pattern | `memory_save` type=`learning` |
| Identified a task for later | `memory_save` type=`todo` |
| Found useful docs or references | `memory_save` type=`reference` |
| Learned about the project structure | `context_update` |
| Finished a task | `progress_update` section="Đã hoàn thành" |
| Starting a new task | `progress_update` section="Đang làm" |

### Before Debugging

**Always** call `memory_recall` first to check if you've seen this problem before. This prevents wasting time re-solving known issues.

### Session End (MANDATORY)

Before the user leaves or switches context:

1. Call `session_end` with:
   - `done`: list of completed items
   - `decisions`: important choices made
   - `notes`: anything worth remembering
   - `next_steps`: what to do in the next session
2. This creates a permanent session record the next session will see

### What NOT to save

- Code snippets (they belong in the codebase, not memory)
- Temporary debugging state
- Information already in the code or git history
- Duplicate of something already saved (search first)

## Memory Types

- **decision**: "We chose X over Y because Z" — architectural and technical choices
- **learning**: "Bug was caused by X, fixed by Y" — lessons from debugging or discovery
- **todo**: "Need to implement X" — tasks for future sessions
- **reference**: "API docs at X, config format is Y" — useful external information

## Tags

Use consistent, lowercase tags for searchability:
- Domain: `#auth`, `#api`, `#database`, `#ui`, `#deploy`
- Type: `#bug`, `#performance`, `#security`, `#refactor`
- Priority: `#critical`, `#nice-to-have`

## Example Session Flow

```
1. User: "Let's work on payment-service"
2. You: session_start(project="payment-service")
3. You: "Welcome back! Last session you implemented Stripe webhook handling.
         Open TODO: add idempotency keys. Want to continue?"
4. User: "Yes, let's add idempotency"
5. ... work happens ...
6. You: memory_save(type="decision", title="Idempotency via Redis SETNX",
         content="Using Redis SETNX with 24h TTL for webhook idempotency...")
7. You: progress_update(section="Đã hoàn thành", items=["Stripe webhook idempotency"])
8. User: "Done for today"
9. You: session_end(project="payment-service", session_id="...",
         done=["Added idempotency keys via Redis SETNX"],
         decisions=["Use Redis SETNX with 24h TTL for idempotency"],
         next_steps=["Add retry logic for failed webhooks", "Write integration tests"])
```
