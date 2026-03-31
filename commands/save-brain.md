# /save-brain — Save session to memory

You are ending a session. Do these steps:

## Step 1: Identify what happened

Look back at the ENTIRE conversation and extract:
- **Done**: What tasks were completed
- **Decisions**: Important technical choices made (and WHY)
- **Learnings**: Bugs found, workarounds discovered, patterns learned
- **Next steps**: What should be done next session

## Step 2: Save session summary

Call `session_end` with the extracted information.

## Step 3: Save individual memories

For each SIGNIFICANT decision or learning (not trivial ones), call `memory_save` separately so they are individually searchable later.

Only save things that:
- Would be painful to rediscover (hours of debugging → 1 learning)
- Affect future decisions (chose X over Y because Z)
- Are NOT obvious from reading the code

## Step 4: Update progress

Call `progress_update` to update:
- "Đã hoàn thành" — what was finished today
- "Đang làm" — what's still in progress  
- "Tiếp theo" — what comes next

## Step 5: Confirm

Tell the user briefly what was saved. Example:
> "Đã lưu session: 3 tasks done, 1 decision (dùng Redis cho cache), 
> 2 next steps. Lần sau gõ `/brain` là mình nhớ lại."

## Important

- Be thorough but not verbose.
- Speak Vietnamese.
- Don't save code snippets — save the WHY and CONTEXT.
