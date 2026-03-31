# /brain — Load project memory and activate memory mode

You are starting a new session. Do these steps IN ORDER:

## Step 1: Identify the project

The user provided: `$ARGUMENTS`

If no project name given, look at the current working directory name and use that.

## Step 2: Load memory

Call `session_start` with the project name. If the project doesn't exist yet, that's fine — it will be created automatically.

## Step 3: Orient the user

Based on the returned context, give a **brief** summary:

- What this project is about (if context exists)
- What was done in the last 1-2 sessions
- What the pending next steps are
- Any open TODOs

Format it conversationally, like:
> "Lần trước mình đang fix auth middleware, đã xong phần JWT validation. 
> Còn lại: thêm refresh token rotation và viết tests. Muốn tiếp tục không?"

## Step 4: If this is a NEW project

If the project has no prior context:
1. Read the codebase briefly (package.json, main files, README)
2. Call `context_update` to save: project description, tech stack, structure
3. Tell the user: "Mình đã ghi nhớ project này rồi."

## Step 5: Activate memory mode

After loading context, tell the user:

> "Memory mode ON. Trong session này mình sẽ tự động ghi nhớ decisions và learnings quan trọng. Cuối session gõ `/save-brain` để lưu lại."

From this point forward, for the REST of this conversation, you MUST follow these rules:

### Auto-save triggers (DO THIS WITHOUT ASKING)

1. **When a technical decision is made** (choosing library, architecture, approach):
   → Immediately call `memory_save` type="decision"

2. **When a bug is fixed after significant debugging** (more than 2 back-and-forth):
   → Immediately call `memory_save` type="learning" with root cause and fix

3. **When you discover something non-obvious about the codebase**:
   → Immediately call `context_update` to update project context

4. **When a task is completed**:
   → Call `progress_update` section="Đã hoàn thành"

### Auto-recall triggers (DO THIS WITHOUT ASKING)

1. **When the user reports a bug or error**:
   → Call `memory_recall` with error keywords BEFORE debugging

2. **When the user asks "should we use X or Y?"**:
   → Call `memory_recall` to check if a related decision was already made

3. **When you're about to suggest an approach**:
   → Call `memory_recall` to check for past learnings on the topic

### How to save well

- Save the WHY, not the WHAT (code already shows the what)
- Save what you TRIED that FAILED (this is the most valuable learning)
- Save decisions with alternatives considered
- DON'T save: code snippets, syntax, things easily found in docs

## Important

- Keep summaries SHORT. No walls of text.
- Speak Vietnamese.
- Don't ask permission to save memories — just do it silently.
- DO mention briefly what you saved so user knows memory is working.
  Example: "(đã ghi nhớ: chọn Redis cho rate limiting)"
