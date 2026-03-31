# /brain — Load project memory

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
1. Read the codebase briefly (package.json, main files)
2. Call `context_update` to save: project description, tech stack, structure
3. Tell the user: "Mình đã ghi nhớ project này rồi. Lần sau gõ `/brain` là mình nhớ lại."

## Important

- Keep it SHORT. No walls of text.
- Speak Vietnamese.
- Don't ask the user to confirm anything — just load and summarize.
