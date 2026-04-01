# Obsidian Memory Layer MCP

> Long-term memory for AI coding assistants, powered by Obsidian.

AI coding assistants (opencode, Claude Code, Cursor...) forget everything when a session ends. This MCP server gives them a persistent brain — storing decisions, learnings, progress, and session history as Obsidian markdown files you can browse, search, and visualize with Graph View.

![Obsidian Memory Layer MCP architecture](./memory-layer.png)

*Architecture overview: MCP tool calls are translated into Obsidian-friendly markdown files, which then become part of the vault and knowledge graph.*

```text
AI Agent <== MCP Protocol ==> obsidian-memory-layer-mcp <== File I/O ==> Obsidian Vault
                                                                              |
                                                                    Open in Obsidian app
                                                                    to see Graph View
```

## Why this exists

| Problem | Solution |
|---------|----------|
| New session = amnesia. Agent forgets what you were working on | `session_start` loads full project context automatically |
| Repeating the same decisions every session | Decisions are saved and recalled before re-deciding |
| No way to track progress across sessions | Progress file updated automatically per session |
| Agent makes the same mistake twice | Learnings are searchable so the agent can check before debugging |
| Can't see the big picture of your AI knowledge | Obsidian Graph View shows all connections |

## Quick Start — Let your agent set it up

### Prerequisites

You need these installed before starting:

- **Node.js** >= 18 — [Download](https://nodejs.org/)
- **Obsidian** — [Download](https://obsidian.md/) (create a vault if you don't have one)
- **An MCP-compatible AI client** — [opencode](https://opencode.ai/), Claude Code, Cursor, etc.

### Option A: Copy this prompt into your agent

Paste this into your AI agent (opencode, Claude Code, Cursor chat, etc.) and let it do the rest:

````text
Set up the Obsidian Memory Layer MCP server for me.

Repository: https://github.com/honam867/obsidian-memory-layer-mcp

Steps:
1. Clone the repo to a local directory
2. Run `npm install && npm run build` inside it
3. Find my Obsidian vault path (look for a folder containing `.obsidian/`)
4. Add the MCP server to my AI client config:
   - For opencode: edit ~/.config/opencode/opencode.json, add to "mcp" section:
     {
       "obsidian-memory": {
         "type": "local",
         "command": ["node", "<path-to-repo>/dist/index.js", "<vault-path>"],
         "enabled": true
       }
     }
   - For Claude Code: edit ~/.claude.json, add to "mcpServers":
     {
       "obsidian-memory": {
         "command": "node",
         "args": ["<path-to-repo>/dist/index.js", "<vault-path>"]
       }
     }
   - For Cursor: edit .cursor/mcp.json with the same format as Claude Code
5. Optionally add AGENTS.md from the repo to instructions config so I know how to use memory tools
6. Test by calling `project_list` tool to verify the server is running

Replace <path-to-repo> and <vault-path> with actual absolute paths.
Use forward slashes even on Windows.
````

### Option B: Manual setup (3 steps)

**Step 1 — Clone and build:**

```bash
git clone https://github.com/honam867/obsidian-memory-layer-mcp.git
cd obsidian-memory-layer-mcp
npm install
npm run build
```

**Step 2 — Add to your AI client config:**

<details>
<summary><strong>opencode</strong> (~/.config/opencode/opencode.json)</summary>

```jsonc
{
  "mcp": {
    "obsidian-memory": {
      "type": "local",
      "command": [
        "node",
        "/path/to/obsidian-memory-layer-mcp/dist/index.js",
        "/path/to/your/obsidian/vault"
      ],
      "enabled": true
    }
  },
  // Optional: teach the AI when to save/recall memories
  "instructions": [
    "/path/to/obsidian-memory-layer-mcp/AGENTS.md"
  ]
}
```

</details>

<details>
<summary><strong>Claude Code</strong> (~/.claude.json)</summary>

```json
{
  "mcpServers": {
    "obsidian-memory": {
      "command": "node",
      "args": [
        "/path/to/obsidian-memory-layer-mcp/dist/index.js",
        "/path/to/your/obsidian/vault"
      ]
    }
  }
}
```

</details>

<details>
<summary><strong>Cursor</strong> (.cursor/mcp.json)</summary>

```json
{
  "mcpServers": {
    "obsidian-memory": {
      "command": "node",
      "args": [
        "/path/to/obsidian-memory-layer-mcp/dist/index.js",
        "/path/to/your/obsidian/vault"
      ]
    }
  }
}
```

</details>

<details>
<summary><strong>Environment variable</strong> (alternative to path argument)</summary>

```bash
export OBSIDIAN_VAULT_PATH="/path/to/your/obsidian/vault"
```

Then omit the vault path from the command args.

</details>

> **Tip:** Replace all paths with absolute paths. Use forward slashes `/` even on Windows.

> **Finding your vault path:** Open Obsidian → Settings → scroll to bottom → you'll see the vault path. Or search your filesystem for a folder containing `.obsidian/`.

**Step 3 — Restart your AI client.** The server auto-creates `AI-Memory/` in your vault on first run. No accounts, no API keys, no cloud services needed.

## How to use

### Start of session → Load memory

Tell your agent which project you're working on. It calls `session_start` and loads everything it knows:

```text
You: Let's work on my-api-server.
AI:  → session_start(project="my-api-server")
     "Welcome back! Last session you were fixing the auth middleware.
      Open TODOs: implement rate limiting, add tests for /users endpoint.
      Want to continue with the auth fix?"
```

### During work → Memories are saved as they happen

```text
You: Let's use JWT instead of session cookies.
AI:  → memory_save(type="decision", title="JWT over session cookies", ...)
     (saved decision: JWT over session cookies)

     ... later, you hit a bug ...

You: Getting a CORS error again.
AI:  → memory_recall(query="CORS")
     "Found a learning from 2 weeks ago: CORS error was caused by
      missing credentials:true. Let me check if that's the issue."
```

### End of session → Save summary

```text
You: I'm done for today.
AI:  → session_end(done=["Fixed auth middleware", "Added JWT validation"],
        next_steps=["Add refresh token rotation", "Write auth tests"])
     "Session saved. Next time you open this project I'll remember where we left off."
```

### OpenCode custom commands (optional)

If you use opencode, copy the `commands/` folder content into your config for shortcuts:

| Command | What it does |
|---------|--------------|
| `/brain my-project` | Load memory and activate auto-save for the session |
| `/save-brain` | Auto-summarize and save everything from current session |
| `/recall cors bug` | Quick search through past memories |

Add to `opencode.json`:

```jsonc
{
  "command": {
    "brain": {
      "description": "Load project memory from Obsidian",
      "template": "{file:/path/to/obsidian-memory-layer-mcp/commands/brain.md}\n\n$ARGUMENTS"
    },
    "save-brain": {
      "description": "Save session to Obsidian memory",
      "template": "{file:/path/to/obsidian-memory-layer-mcp/commands/save-brain.md}\n\n$ARGUMENTS"
    },
    "recall": {
      "description": "Search past memories",
      "template": "{file:/path/to/obsidian-memory-layer-mcp/commands/recall.md}\n\n$ARGUMENTS"
    }
  }
}
```

## What gets stored in your vault

```text
AI-Memory/
├── _index.md                  # Global index with [[wiki-links]] to all projects
└── projects/
    └── my-project/
        ├── _context.md        # Project description, tech stack, structure
        ├── _progress.md       # What's done, in progress, next up
        ├── decisions/         # "Chose JWT because we need stateless auth"
        ├── sessions/          # Log of every work session
        ├── learnings/         # "Bug was caused by race condition, fixed by mutex"
        ├── todos/             # Pending tasks
        └── references/        # External links, docs, notes
```

All files use `[[wiki-links]]` and `#tags` so you can open Obsidian, hit `Ctrl+G`, and see how sessions, decisions, and learnings connect across projects.

## Tools reference

| Tool | Purpose |
|------|---------|
| `session_start` | Load project context and create a new session log |
| `session_end` | Save what was done, decisions, and next steps |
| `memory_save` | Store a decision, learning, todo, or reference |
| `memory_recall` | Search through saved memories |
| `memory_update` | Update an existing memory |
| `memory_delete` | Remove a memory |
| `project_status` | View project context, progress, TODOs, recent sessions |
| `project_list` | List all projects in memory |
| `context_update` | Update project description, tech stack, or structure |
| `progress_update` | Update what's doing, done, or next |

## How it works (no auth needed)

An Obsidian vault is just a folder of `.md` files on your disk. This MCP server reads and writes to that folder via `fs.readFile`/`fs.writeFile`. No HTTP, no database, no credentials.

Obsidian app and this server both access the same folder. Changes from the agent appear instantly in Obsidian, and edits you make in Obsidian are readable by the agent immediately.

## Setting up on a new machine

1. Clone this repo
2. `npm install && npm run build`
3. Find your Obsidian vault path
4. Add MCP config to your AI client (see examples above)
5. Start chatting — `AI-Memory/` folder is created automatically

Or just paste the [agent setup prompt](#option-a-copy-this-prompt-into-your-agent) and let your agent handle it.

## Repository structure

| File | Purpose |
|------|---------|
| [`src/index.ts`](./src/index.ts) | MCP server with all 10 tools |
| [`src/vault.ts`](./src/vault.ts) | Markdown-based storage, search, and session management |
| [`AGENTS.md`](./AGENTS.md) | Instructions for AI agents on when to save/recall |
| [`commands/`](./commands/) | OpenCode custom command templates |

## License

MIT
