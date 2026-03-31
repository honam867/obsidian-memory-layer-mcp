# Obsidian Memory Layer MCP

> Long-term memory for AI coding assistants, powered by Obsidian.

AI coding assistants (opencode, Claude Code, Cursor...) forget everything when a session ends. This MCP server gives them a **persistent brain** — storing decisions, learnings, progress, and session history as Obsidian markdown files you can browse, search, and visualize with Graph View.

```
AI Agent ◄── MCP Protocol ──► obsidian-memory-layer-mcp ◄── File I/O ──► Obsidian Vault
                                                                              │
                                                                    You can open this
                                                                    in Obsidian app and
                                                                    see everything in
                                                                    Graph View ✨
```

## Why this exists

| Problem | Solution |
|---------|----------|
| New session = amnesia. Agent forgets what you were working on | `session_start` loads full project context automatically |
| Repeating the same decisions every session | Decisions are saved and recalled before re-deciding |
| No way to track progress across sessions | Progress file updated automatically per session |
| Agent makes same mistake twice | Learnings are searchable — agent checks before debugging |
| Can't see the big picture of your AI knowledge | Obsidian Graph View shows all connections |

## What you get

```
YourVault/
└── AI-Memory/
    ├── _index.md                    # Global index with [[wiki-links]]
    └── projects/
        └── my-project/
            ├── _context.md          # Project description, tech stack, structure
            ├── _progress.md         # What's done, in progress, next up
            ├── decisions/           # Architecture & technical decisions
            ├── sessions/            # Log of every work session
            ├── learnings/           # Bugs found, patterns discovered
            ├── todos/               # Pending tasks
            └── references/          # External links, docs, notes
```

All files use Obsidian `[[wiki-links]]` and `#tags` — open your vault in Obsidian, hit `Ctrl+G`, and see how everything connects.

## Quick Setup

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Obsidian](https://obsidian.md/) installed with a vault (any vault works)
- [opencode](https://opencode.ai/) (or any MCP-compatible AI client)

### 1. Clone & Build

```bash
git clone https://github.com/honam867/obsidian-memory-layer-mcp.git
cd obsidian-memory-layer-mcp
npm install
npm run build
```

### 2. Configure opencode

Add to your opencode config (`~/.config/opencode/opencode.json`):

```jsonc
{
  "mcp": {
    "obsidian-memory": {
      "type": "local",
      "command": [
        "node",
        "/absolute/path/to/obsidian-memory-layer-mcp/dist/index.js",
        "/absolute/path/to/your/obsidian/vault"
      ],
      "enabled": true
    }
  },
  // Optional: load AGENTS.md as instructions so the AI knows the rules
  "instructions": [
    "/absolute/path/to/obsidian-memory-layer-mcp/AGENTS.md"
  ]
}
```

> **Tip:** Replace paths with your actual paths. Use forward slashes even on Windows.

### 3. Done

Open opencode and start chatting. The AI now has access to 10 memory tools.

## Tools Reference

### Session lifecycle

| Tool | When to use | What it does |
|------|-------------|--------------|
| `session_start` | **First thing** every session | Creates session log, loads project context + progress + TODOs |
| `session_end` | **Last thing** before closing | Saves what was done, decisions made, and next steps |

### Memory CRUD

| Tool | When to use | What it does |
|------|-------------|--------------|
| `memory_save` | Learn something new, make a decision | Saves a memory (type: `decision` / `learning` / `todo` / `reference`) |
| `memory_recall` | Need to remember something | Full-text search across all memories |
| `memory_update` | Information changed | Updates existing memory by ID |
| `memory_delete` | Info is wrong or outdated | Removes a memory |

### Project management

| Tool | When to use | What it does |
|------|-------------|--------------|
| `project_status` | Quick overview | Shows context, progress, TODOs, recent sessions |
| `project_list` | Which projects exist? | Lists all projects in memory |
| `context_update` | Learned something about the project | Updates project description, tech stack, or structure |
| `progress_update` | Finished a task / planning next | Updates "doing", "done", or "next" lists |

## Usage Examples

### Starting a new session
```
You: Let's work on my-api-server
AI:  → calls session_start(project="my-api-server")
     → "Welcome back! Last session you were fixing the auth middleware.
        Open TODOs: implement rate limiting, add tests for /users endpoint.
        Want to continue with the auth fix?"
```

### Saving a decision
```
You: Let's use JWT instead of session cookies
AI:  → calls memory_save(
         project="my-api-server",
         type="decision",
         title="Use JWT over session cookies",
         content="Chose JWT for stateless auth. Session cookies would require Redis...",
         tags=["auth", "architecture"]
       )
```

### Recalling past learnings
```
You: I'm getting a CORS error again
AI:  → calls memory_recall(query="CORS", project="my-api-server")
     → "Found a learning from 2 weeks ago: CORS error was caused by missing
        credentials: true in the fetch options. Check if that's the issue."
```

### Ending a session
```
You: I'm done for today
AI:  → calls session_end(
         project="my-api-server",
         session_id="session-2024-03-15-...",
         done=["Fixed auth middleware", "Added JWT validation"],
         decisions=["Use RS256 for JWT signing"],
         next_steps=["Add refresh token rotation", "Write auth tests"]
       )
```

## For Other MCP Clients

### Claude Code

Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "obsidian-memory": {
      "command": "node",
      "args": ["/path/to/obsidian-memory-layer-mcp/dist/index.js", "/path/to/vault"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "obsidian-memory": {
      "command": "node",
      "args": ["/path/to/obsidian-memory-layer-mcp/dist/index.js", "/path/to/vault"]
    }
  }
}
```

### Environment variable (alternative)

Instead of passing the vault path as an argument, you can set:

```bash
export OBSIDIAN_VAULT_PATH="/path/to/your/obsidian/vault"
```

## Setting up on a new machine

1. Clone this repo
2. `npm install && npm run build`
3. Find your Obsidian vault path (open Obsidian → Settings → look at vault location)
4. Add MCP config to your AI client (see examples above)
5. Copy `AGENTS.md` to your instructions path
6. Start chatting — the server auto-creates `AI-Memory/` in your vault on first run

No accounts, no API keys, no cloud services. It reads/writes markdown files directly to your local Obsidian vault folder.

## How it works (no auth needed)

An Obsidian vault is just a folder of `.md` files. This MCP server reads and writes directly to that folder via Node.js `fs` — no HTTP, no API, no credentials.

```
┌─────────────────┐     stdio/MCP      ┌──────────────────┐    fs.readFile     ┌─────────────┐
│  opencode/       │ ◄───────────────► │  This MCP Server  │ ◄───────────────► │  ~/vault/    │
│  Claude Code/    │                    │  (Node.js)        │    fs.writeFile   │  AI-Memory/  │
│  Cursor          │                    │                   │                    │  *.md files  │
└─────────────────┘                    └──────────────────┘                    └─────────────┘
                                                                                     │
                                                                            Obsidian app reads
                                                                            the same folder
```

Obsidian app and this server both access the same folder. Changes appear instantly in both directions.

## License

MIT
