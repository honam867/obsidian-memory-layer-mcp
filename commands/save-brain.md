# /save-brain — Save session to memory

You are ending a session. Do these steps:

## Step 1: Identify what happened

Look back at the ENTIRE conversation and extract:
- **Done**: What tasks were completed
- **Decisions**: Important technical choices made (and WHY) — skip if already saved during session
- **Learnings**: Bugs found, workarounds discovered, patterns learned — skip if already saved
- **Next steps**: What should be done next session

## Step 2: Save session summary

Call `session_end` with the extracted information.

## Step 3: Save NEW memories only

Check what was already saved during the session (via auto-save).
For each SIGNIFICANT item NOT yet saved, call `memory_save`.

Only save things that:
- Would be painful to rediscover (hours of debugging → 1 learning)
- Affect future decisions (chose X over Y because Z)
- Are NOT obvious from reading the code
- Were NOT already saved during this session

## Step 4: Update progress

Call `progress_update` to update:
- "Đã hoàn thành" — what was finished
- "Đang làm" — what's still in progress
- "Tiếp theo" — what comes next

## Step 5: Confirm

Tell the user briefly what was saved. Example:
> "Đã lưu session: 3 tasks done, 1 decision mới, 2 next steps.
> Lần sau gõ `/brain project-name` là mình nhớ lại."

## Important

- Be thorough but not verbose.
- Speak Vietnamese.
- Don't save code snippets — save the WHY and CONTEXT.
- Don't duplicate memories already saved during session.
