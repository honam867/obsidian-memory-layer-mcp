/**
 * Obsidian Vault Manager - CRUD operations on markdown files
 * Treats Obsidian vault as a structured knowledge base
 */

import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { glob } from "glob";

export interface MemoryEntry {
  id: string;
  title: string;
  type: "context" | "decision" | "learning" | "progress" | "session" | "todo" | "reference";
  project: string;
  tags: string[];
  created: string;
  updated: string;
  content: string;
  links: string[];
}

export interface ProjectStatus {
  project: string;
  context: string | null;
  progress: string | null;
  recentSessions: string[];
  openTodos: string[];
  decisionCount: number;
  learningCount: number;
}

export class VaultManager {
  private vaultPath: string;
  private memoryRoot: string;

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
    this.memoryRoot = path.join(vaultPath, "AI-Memory");
  }

  // --- Initialization ---

  async init(): Promise<void> {
    const dirs = [
      this.memoryRoot,
      path.join(this.memoryRoot, "projects"),
      path.join(this.memoryRoot, "global"),
      path.join(this.memoryRoot, "templates"),
    ];
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    // Create global index if not exists
    const indexPath = path.join(this.memoryRoot, "_index.md");
    try {
      await fs.access(indexPath);
    } catch {
      await fs.writeFile(
        indexPath,
        `---\ntitle: AI Memory Index\nupdated: ${this.now()}\n---\n\n# AI Memory Index\n\nThis vault stores long-term memory for AI coding assistants.\n\n## Projects\n\n_(auto-updated)_\n`,
        "utf-8"
      );
    }
  }

  // --- Project Management ---

  async ensureProject(project: string): Promise<string> {
    const projectDir = path.join(this.memoryRoot, "projects", this.slug(project));
    const dirs = [
      projectDir,
      path.join(projectDir, "decisions"),
      path.join(projectDir, "sessions"),
      path.join(projectDir, "learnings"),
      path.join(projectDir, "todos"),
      path.join(projectDir, "references"),
    ];
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    // Create _context.md if not exists
    const contextPath = path.join(projectDir, "_context.md");
    try {
      await fs.access(contextPath);
    } catch {
      await fs.writeFile(
        contextPath,
        [
          "---",
          `title: "${project} - Context"`,
          `project: "${project}"`,
          "type: context",
          `created: "${this.now()}"`,
          `updated: "${this.now()}"`,
          "---",
          "",
          `# ${project}`,
          "",
          "## Mô tả dự án",
          "",
          "_(Chưa có mô tả)_",
          "",
          "## Tech Stack",
          "",
          "## Cấu trúc chính",
          "",
          "## Ghi chú quan trọng",
          "",
        ].join("\n"),
        "utf-8"
      );
    }

    // Create _progress.md if not exists
    const progressPath = path.join(projectDir, "_progress.md");
    try {
      await fs.access(progressPath);
    } catch {
      await fs.writeFile(
        progressPath,
        [
          "---",
          `title: "${project} - Progress"`,
          `project: "${project}"`,
          "type: progress",
          `created: "${this.now()}"`,
          `updated: "${this.now()}"`,
          "---",
          "",
          `# ${project} - Tiến độ`,
          "",
          "## Đang làm",
          "",
          "## Đã hoàn thành",
          "",
          "## Tiếp theo",
          "",
        ].join("\n"),
        "utf-8"
      );
    }

    return projectDir;
  }

  async listProjects(): Promise<string[]> {
    const projectsDir = path.join(this.memoryRoot, "projects");
    try {
      const entries = await fs.readdir(projectsDir, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return [];
    }
  }

  // --- Memory CRUD ---

  async save(entry: Omit<MemoryEntry, "id" | "created" | "updated">): Promise<MemoryEntry> {
    const projectDir = await this.ensureProject(entry.project);
    const id = `${this.slug(entry.title)}-${Date.now()}`;
    const now = this.now();

    const typeDir = this.getTypeDir(entry.type);
    const filePath = path.join(projectDir, typeDir, `${id}.md`);

    // Auto-generate Obsidian wiki-links for graph connectivity
    const autoLinks = this.generateAutoLinks(entry.project, entry.type);
    const allLinks = [...new Set([...entry.links, ...autoLinks])];

    const frontmatter: Record<string, unknown> = {
      title: entry.title,
      type: entry.type,
      project: entry.project,
      tags: entry.tags.map((t) => t.startsWith("#") ? t : `#${t}`),
      created: now,
      updated: now,
      aliases: [entry.title],
    };

    // Append wiki-links at bottom for Obsidian graph view
    const linksSection = allLinks.length > 0
      ? `\n\n---\n**Links:** ${allLinks.map((l) => l.startsWith("[[") ? l : `[[${l}]]`).join(" | ")}\n`
      : "";

    const fileContent = matter.stringify(entry.content + linksSection, frontmatter);
    await fs.writeFile(filePath, fileContent, "utf-8");

    // Update global index
    await this.updateIndex();

    return { ...entry, id, created: now, updated: now, links: allLinks };
  }

  async read(project: string, id: string): Promise<MemoryEntry | null> {
    const projectDir = path.join(this.memoryRoot, "projects", this.slug(project));
    const files = await glob(`${projectDir}/**/${id}.md`);

    if (files.length === 0) return null;

    const content = await fs.readFile(files[0], "utf-8");
    const parsed = matter(content);

    return {
      id,
      title: parsed.data.title ?? "",
      type: parsed.data.type ?? "reference",
      project: parsed.data.project ?? project,
      tags: parsed.data.tags ?? [],
      created: parsed.data.created ?? "",
      updated: parsed.data.updated ?? "",
      content: parsed.content.trim(),
      links: parsed.data.links ?? [],
    };
  }

  async update(project: string, id: string, updates: { content?: string; tags?: string[]; links?: string[]; title?: string }): Promise<boolean> {
    const projectDir = path.join(this.memoryRoot, "projects", this.slug(project));
    const files = await glob(`${projectDir}/**/${id}.md`);

    if (files.length === 0) return false;

    const filePath = files[0];
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = matter(raw);

    if (updates.title !== undefined) parsed.data.title = updates.title;
    if (updates.tags !== undefined) parsed.data.tags = updates.tags;
    if (updates.links !== undefined) parsed.data.links = updates.links;
    parsed.data.updated = this.now();

    const newContent = updates.content !== undefined ? updates.content : parsed.content;
    const fileContent = matter.stringify(newContent, parsed.data);
    await fs.writeFile(filePath, fileContent, "utf-8");

    return true;
  }

  async delete(project: string, id: string): Promise<boolean> {
    const projectDir = path.join(this.memoryRoot, "projects", this.slug(project));
    const files = await glob(`${projectDir}/**/${id}.md`);

    if (files.length === 0) return false;

    await fs.unlink(files[0]);
    return true;
  }

  // --- Search ---

  async search(query: string, options?: { project?: string; type?: string; tags?: string[] }): Promise<MemoryEntry[]> {
    let searchPath: string;
    if (options?.project) {
      searchPath = path.join(this.memoryRoot, "projects", this.slug(options.project));
    } else {
      searchPath = path.join(this.memoryRoot, "projects");
    }

    const files = await glob(`${searchPath}/**/*.md`);
    const results: MemoryEntry[] = [];
    const queryLower = query.toLowerCase();

    for (const file of files) {
      const raw = await fs.readFile(file, "utf-8");
      const parsed = matter(raw);

      // Filter by type
      if (options?.type && parsed.data.type !== options.type) continue;

      // Filter by tags
      if (options?.tags?.length) {
        const entryTags: string[] = parsed.data.tags ?? [];
        const hasTag = options.tags.some((t) => entryTags.includes(t));
        if (!hasTag) continue;
      }

      // Text search in title + content
      const titleMatch = (parsed.data.title ?? "").toLowerCase().includes(queryLower);
      const contentMatch = parsed.content.toLowerCase().includes(queryLower);
      const tagMatch = (parsed.data.tags ?? []).some((t: string) => t.toLowerCase().includes(queryLower));

      if (titleMatch || contentMatch || tagMatch) {
        const id = path.basename(file, ".md");
        results.push({
          id,
          title: parsed.data.title ?? "",
          type: parsed.data.type ?? "reference",
          project: parsed.data.project ?? "",
          tags: parsed.data.tags ?? [],
          created: parsed.data.created ?? "",
          updated: parsed.data.updated ?? "",
          content: parsed.content.trim(),
          links: parsed.data.links ?? [],
        });
      }
    }

    // Sort by updated date, newest first
    results.sort((a, b) => b.updated.localeCompare(a.updated));
    return results;
  }

  // --- Project Status ---

  async getProjectStatus(project: string): Promise<ProjectStatus> {
    const projectDir = path.join(this.memoryRoot, "projects", this.slug(project));

    const readFileContent = async (filePath: string): Promise<string | null> => {
      try {
        const raw = await fs.readFile(filePath, "utf-8");
        const parsed = matter(raw);
        return parsed.content.trim();
      } catch {
        return null;
      }
    };

    const countFiles = async (dir: string): Promise<number> => {
      try {
        const files = await glob(`${dir}/*.md`);
        return files.length;
      } catch {
        return 0;
      }
    };

    const getRecentFiles = async (dir: string, limit: number): Promise<string[]> => {
      try {
        const files = await glob(`${dir}/*.md`);
        const withStats = await Promise.all(
          files.map(async (f) => {
            const stat = await fs.stat(f);
            const raw = await fs.readFile(f, "utf-8");
            const parsed = matter(raw);
            return { title: parsed.data.title ?? path.basename(f, ".md"), mtime: stat.mtimeMs };
          })
        );
        withStats.sort((a, b) => b.mtime - a.mtime);
        return withStats.slice(0, limit).map((f) => f.title);
      } catch {
        return [];
      }
    };

    const getTodos = async (dir: string): Promise<string[]> => {
      try {
        const files = await glob(`${dir}/*.md`);
        const todos: string[] = [];
        for (const f of files) {
          const raw = await fs.readFile(f, "utf-8");
          const parsed = matter(raw);
          if (parsed.data.status !== "done") {
            todos.push(parsed.data.title ?? path.basename(f, ".md"));
          }
        }
        return todos;
      } catch {
        return [];
      }
    };

    return {
      project,
      context: await readFileContent(path.join(projectDir, "_context.md")),
      progress: await readFileContent(path.join(projectDir, "_progress.md")),
      recentSessions: await getRecentFiles(path.join(projectDir, "sessions"), 5),
      openTodos: await getTodos(path.join(projectDir, "todos")),
      decisionCount: await countFiles(path.join(projectDir, "decisions")),
      learningCount: await countFiles(path.join(projectDir, "learnings")),
    };
  }

  // --- Session Management ---

  async startSession(project: string, goal?: string): Promise<string> {
    const projectDir = await this.ensureProject(project);
    const now = this.now();
    const sessionId = `session-${now.replace(/[:\s]/g, "-")}`;
    const filePath = path.join(projectDir, "sessions", `${sessionId}.md`);

    const slug = this.slug(project);
    const content = [
      `# Session: ${now}`,
      "",
      `## Mục tiêu`,
      "",
      goal ?? "_(Chưa xác định)_",
      "",
      "## Đã làm",
      "",
      "## Quyết định",
      "",
      "## Ghi chú",
      "",
      "---",
      `**Project:** [[${slug}/_context|${project}]] | **Progress:** [[${slug}/_progress|Tiến độ]]`,
      "",
    ].join("\n");

    const frontmatter: Record<string, unknown> = {
      title: `Session ${now}`,
      type: "session",
      project,
      status: "active",
      created: now,
      updated: now,
      tags: ["#session", `#project/${slug}`],
      aliases: [`Session ${now}`],
    };

    await fs.writeFile(filePath, matter.stringify(content, frontmatter), "utf-8");

    return sessionId;
  }

  async endSession(
    project: string,
    sessionId: string,
    summary: { done: string[]; decisions: string[]; notes: string[]; nextSteps: string[] }
  ): Promise<boolean> {
    const projectDir = path.join(this.memoryRoot, "projects", this.slug(project));
    const files = await glob(`${projectDir}/sessions/${sessionId}.md`);

    if (files.length === 0) return false;

    const filePath = files[0];
    const now = this.now();

    const content = [
      `# Session: ${sessionId}`,
      "",
      "## Đã làm",
      ...summary.done.map((d) => `- ${d}`),
      "",
      "## Quyết định",
      ...summary.decisions.map((d) => `- ${d}`),
      "",
      "## Ghi chú",
      ...summary.notes.map((n) => `- ${n}`),
      "",
      "## Bước tiếp theo",
      ...summary.nextSteps.map((s) => `- ${s}`),
      "",
    ].join("\n");

    const frontmatter: Record<string, unknown> = {
      title: `Session ${sessionId}`,
      type: "session",
      project,
      status: "completed",
      created: sessionId.replace("session-", "").replace(/-/g, " "),
      updated: now,
      tags: ["session", "completed"],
    };

    await fs.writeFile(filePath, matter.stringify(content, frontmatter), "utf-8");

    // Also update progress file
    const progressPath = path.join(projectDir, "_progress.md");
    try {
      const raw = await fs.readFile(progressPath, "utf-8");
      const parsed = matter(raw);
      const progressContent = parsed.content + `\n### ${now}\n` + summary.done.map((d) => `- ✅ ${d}`).join("\n") + "\n";
      parsed.data.updated = now;
      await fs.writeFile(progressPath, matter.stringify(progressContent, parsed.data), "utf-8");
    } catch {
      // Progress file doesn't exist, skip
    }

    return true;
  }

  // --- Context Loading (for session start) ---

  async loadContextBrief(project: string): Promise<string> {
    const status = await this.getProjectStatus(project);
    const parts: string[] = [];

    parts.push(`# Memory: ${project}`);
    parts.push("");

    // Only the project description section (first ~10 lines of context)
    if (status.context) {
      const lines = status.context.split("\n").filter((l) => l.trim());
      parts.push(lines.slice(0, 12).join("\n"));
      parts.push("");
    }

    // Only last session title
    if (status.recentSessions.length > 0) {
      parts.push(`**Last session:** ${status.recentSessions[0]}`);
    }

    // Open TODOs (just titles)
    if (status.openTodos.length > 0) {
      parts.push(`**Open TODOs:** ${status.openTodos.slice(0, 5).join(", ")}`);
    }

    // Stats as one line
    parts.push(`**Stats:** ${status.decisionCount} decisions, ${status.learningCount} learnings, ${status.openTodos.length} TODOs`);
    parts.push("");
    parts.push("Use `project_status` for full details. Use `memory_recall` to search specific topics.");

    return parts.join("\n");
  }

  async loadContextFull(project: string): Promise<string> {
    const status = await this.getProjectStatus(project);
    const parts: string[] = [];

    parts.push(`# Memory Context: ${project}`);
    parts.push("");

    if (status.context) {
      parts.push("## Project Context");
      parts.push(status.context);
      parts.push("");
    }

    if (status.progress) {
      parts.push("## Progress");
      parts.push(status.progress);
      parts.push("");
    }

    if (status.openTodos.length > 0) {
      parts.push("## Open TODOs");
      status.openTodos.forEach((t) => parts.push(`- [ ] ${t}`));
      parts.push("");
    }

    if (status.recentSessions.length > 0) {
      parts.push("## Recent Sessions");
      status.recentSessions.forEach((s) => parts.push(`- ${s}`));
      parts.push("");
    }

    parts.push(`## Stats`);
    parts.push(`- Decisions recorded: ${status.decisionCount}`);
    parts.push(`- Learnings recorded: ${status.learningCount}`);
    parts.push(`- Open TODOs: ${status.openTodos.length}`);

    return parts.join("\n");
  }

  // --- Update Context ---

  async updateContext(project: string, section: string, content: string): Promise<boolean> {
    const projectDir = path.join(this.memoryRoot, "projects", this.slug(project));
    const contextPath = path.join(projectDir, "_context.md");

    try {
      const raw = await fs.readFile(contextPath, "utf-8");
      const parsed = matter(raw);

      // Find and replace section
      const sectionRegex = new RegExp(`(## ${section})\n[\\s\\S]*?(?=\n## |$)`, "m");
      const newSection = `## ${section}\n\n${content}\n`;

      if (sectionRegex.test(parsed.content)) {
        parsed.content = parsed.content.replace(sectionRegex, newSection);
      } else {
        parsed.content = parsed.content.trim() + `\n\n${newSection}`;
      }

      parsed.data.updated = this.now();
      await fs.writeFile(contextPath, matter.stringify(parsed.content, parsed.data), "utf-8");
      return true;
    } catch {
      return false;
    }
  }

  // --- Update Progress ---

  async updateProgress(project: string, section: "Đang làm" | "Đã hoàn thành" | "Tiếp theo", items: string[]): Promise<boolean> {
    const projectDir = path.join(this.memoryRoot, "projects", this.slug(project));
    const progressPath = path.join(projectDir, "_progress.md");

    try {
      const raw = await fs.readFile(progressPath, "utf-8");
      const parsed = matter(raw);

      const sectionRegex = new RegExp(`(## ${section})\n[\\s\\S]*?(?=\n## |$)`, "m");
      const newSection = `## ${section}\n\n${items.map((i) => `- ${i}`).join("\n")}\n`;

      if (sectionRegex.test(parsed.content)) {
        parsed.content = parsed.content.replace(sectionRegex, newSection);
      } else {
        parsed.content = parsed.content.trim() + `\n\n${newSection}`;
      }

      parsed.data.updated = this.now();
      await fs.writeFile(progressPath, matter.stringify(parsed.content, parsed.data), "utf-8");
      return true;
    } catch {
      return false;
    }
  }

  // --- Helpers ---

  private generateAutoLinks(project: string, type: MemoryEntry["type"]): string[] {
    const slug = this.slug(project);
    const links: string[] = [`[[${slug}/_context|${project} Context]]`];

    if (type === "decision" || type === "learning") {
      links.push(`[[${slug}/_progress|${project} Progress]]`);
    }

    return links;
  }

  private async updateIndex(): Promise<void> {
    const projects = await this.listProjects();
    const indexPath = path.join(this.memoryRoot, "_index.md");

    const projectLinks = projects.map((p) => `- [[${p}/_context|${p}]]`).join("\n");

    const content = [
      `# AI Memory Index`,
      "",
      `> Auto-updated: ${this.now()}`,
      "",
      "## Projects",
      "",
      projectLinks || "_(no projects yet)_",
      "",
    ].join("\n");

    const frontmatter = { title: "AI Memory Index", updated: this.now() };
    await fs.writeFile(indexPath, matter.stringify(content, frontmatter), "utf-8");
  }

  private getTypeDir(type: MemoryEntry["type"]): string {
    const map: Record<string, string> = {
      context: "",
      decision: "decisions",
      learning: "learnings",
      progress: "",
      session: "sessions",
      todo: "todos",
      reference: "references",
    };
    return map[type] ?? "references";
  }

  private slug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\-_\s]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
  }

  private now(): string {
    const d = new Date();
    const pad = (n: number): string => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
}
