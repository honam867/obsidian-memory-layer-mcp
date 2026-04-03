#!/usr/bin/env node

/**
 * Obsidian Memory MCP Server
 *
 * Provides long-term memory for AI coding assistants via Obsidian vault.
 * Connect this to opencode (or any MCP-compatible client) for persistent
 * project knowledge across sessions.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { VaultManager } from "./vault.js";

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH ?? process.argv[2];

if (!VAULT_PATH) {
  console.error("❌ OBSIDIAN_VAULT_PATH env var or first argument required");
  console.error("Usage: obsidian-memory-mcp /path/to/obsidian/vault");
  process.exit(1);
}

const vault = new VaultManager(VAULT_PATH);
await vault.init();

const server = new McpServer({
  name: "obsidian-memory",
  version: "1.0.0",
});

// ============================================================
// Tool: memory_save - Lưu một memory mới
// ============================================================
server.tool(
  "memory_save",
  `Lưu một memory mới vào Obsidian vault. Dùng khi:
- Học được điều gì mới (learning)
- Ra quyết định quan trọng (decision)
- Ghi chú tham khảo (reference)
- Tạo TODO (todo)`,
  {
    project: z.string().describe("Tên project (e.g. 'cozrum-server', 'paxnex')"),
    title: z.string().describe("Tiêu đề ngắn gọn cho memory"),
    type: z.enum(["decision", "learning", "todo", "reference"]).describe("Loại memory"),
    content: z.string().describe("Nội dung chi tiết"),
    tags: z.array(z.string()).optional().describe("Tags để phân loại (e.g. ['api', 'auth', 'bug'])"),
    links: z.array(z.string()).optional().describe("Obsidian links tới memory khác (e.g. ['[[session-2024-01-01]]'])"),
  },
  async ({ project, title, type, content, tags, links }) => {
    const entry = await vault.save({
      title,
      type,
      project,
      content,
      tags: tags ?? [],
      links: links ?? [],
    });

    return {
      content: [
        {
          type: "text" as const,
          text: `✅ Đã lưu memory: "${entry.title}" (${entry.type})\nID: ${entry.id}\nProject: ${entry.project}`,
        },
      ],
    };
  }
);

// ============================================================
// Tool: memory_recall - Tìm kiếm memory
// ============================================================
server.tool(
  "memory_recall",
  `Tìm kiếm trong bộ nhớ dài hạn. Dùng khi:
- Bắt đầu session mới, cần nhớ lại context
- Tìm quyết định đã được ghi nhận trước đó
- Tìm bài học đã học
- Check xem đã có giải pháp cho vấn đề tương tự chưa`,
  {
    query: z.string().describe("Từ khóa tìm kiếm"),
    project: z.string().optional().describe("Giới hạn tìm trong project cụ thể"),
    type: z.string().optional().describe("Lọc theo type: decision, learning, todo, reference, session"),
    tags: z.array(z.string()).optional().describe("Lọc theo tags"),
  },
  async ({ query, project, type, tags }) => {
    const results = await vault.search(query, { project, type, tags });

    if (results.length === 0) {
      return {
        content: [{ type: "text" as const, text: `Không tìm thấy memory nào cho: "${query}"` }],
      };
    }

    const formatted = results
      .slice(0, 10)
      .map(
        (r) =>
          `### ${r.title}\n- **Type:** ${r.type} | **Project:** ${r.project}\n- **Tags:** ${r.tags.join(", ") || "none"}\n- **Updated:** ${r.updated}\n- **ID:** ${r.id}\n\n${r.content.slice(0, 500)}${r.content.length > 500 ? "..." : ""}`
      )
      .join("\n\n---\n\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `Tìm thấy ${results.length} kết quả:\n\n${formatted}`,
        },
      ],
    };
  }
);

// ============================================================
// Tool: memory_update - Cập nhật memory đã có
// ============================================================
server.tool(
  "memory_update",
  "Cập nhật một memory đã tồn tại. Dùng khi thông tin thay đổi hoặc cần bổ sung.",
  {
    project: z.string().describe("Tên project"),
    id: z.string().describe("ID của memory cần update"),
    content: z.string().optional().describe("Nội dung mới (thay thế hoàn toàn)"),
    tags: z.array(z.string()).optional().describe("Tags mới"),
    title: z.string().optional().describe("Tiêu đề mới"),
  },
  async ({ project, id, content, tags, title }) => {
    const success = await vault.update(project, id, { content, tags, title });
    return {
      content: [
        {
          type: "text" as const,
          text: success ? `✅ Đã cập nhật memory: ${id}` : `❌ Không tìm thấy memory: ${id}`,
        },
      ],
    };
  }
);

// ============================================================
// Tool: memory_delete - Xóa memory
// ============================================================
server.tool(
  "memory_delete",
  "Xóa một memory. Dùng khi thông tin không còn đúng hoặc không cần nữa.",
  {
    project: z.string().describe("Tên project"),
    id: z.string().describe("ID của memory cần xóa"),
  },
  async ({ project, id }) => {
    const success = await vault.delete(project, id);
    return {
      content: [
        {
          type: "text" as const,
          text: success ? `✅ Đã xóa memory: ${id}` : `❌ Không tìm thấy memory: ${id}`,
        },
      ],
    };
  }
);

// ============================================================
// Tool: session_start - Bắt đầu session mới
// ============================================================
server.tool(
  "session_start",
  `Bắt đầu một session làm việc mới. Trả về brief summary (~300 tokens).
Dùng project_status nếu cần xem chi tiết đầy đủ.
Dùng memory_recall để tìm kiếm cụ thể.`,
  {
    project: z.string().describe("Tên project đang làm việc"),
    goal: z.string().optional().describe("Mục tiêu của session này"),
  },
  async ({ project, goal }) => {
    const context = await vault.loadContextBrief(project);
    const sessionId = await vault.startSession(project, goal);

    return {
      content: [
        {
          type: "text" as const,
          text: `🚀 Session started: ${sessionId}\n\n${context}`,
        },
      ],
    };
  }
);

// ============================================================
// Tool: session_end - Kết thúc session
// ============================================================
server.tool(
  "session_end",
  `Kết thúc session hiện tại. GỌI NÀY TRƯỚC KHI ĐÓNG CHAT.
Sẽ lưu lại:
- Những gì đã làm
- Quyết định quan trọng
- Ghi chú
- Bước tiếp theo`,
  {
    project: z.string().describe("Tên project"),
    session_id: z.string().describe("Session ID (từ session_start)"),
    done: z.array(z.string()).describe("Danh sách những gì đã hoàn thành"),
    decisions: z.array(z.string()).optional().describe("Quyết định quan trọng"),
    notes: z.array(z.string()).optional().describe("Ghi chú thêm"),
    next_steps: z.array(z.string()).optional().describe("Việc cần làm tiếp"),
  },
  async ({ project, session_id, done, decisions, notes, next_steps }) => {
    const success = await vault.endSession(project, session_id, {
      done,
      decisions: decisions ?? [],
      notes: notes ?? [],
      nextSteps: next_steps ?? [],
    });

    return {
      content: [
        {
          type: "text" as const,
          text: success
            ? `✅ Session ${session_id} đã kết thúc và lưu lại.\n\n📝 Summary:\n- Done: ${done.length} items\n- Decisions: ${(decisions ?? []).length}\n- Next steps: ${(next_steps ?? []).length}`
            : `❌ Không tìm thấy session: ${session_id}`,
        },
      ],
    };
  }
);

// ============================================================
// Tool: project_status - Xem trạng thái project
// ============================================================
server.tool(
  "project_status",
  "Xem CHI TIẾT ĐẦY ĐỦ trạng thái một project: context, progress, TODOs, recent sessions. Chỉ gọi khi cần xem detail.",
  {
    project: z.string().describe("Tên project"),
  },
  async ({ project }) => {
    const context = await vault.loadContextFull(project);
    return {
      content: [{ type: "text" as const, text: context }],
    };
  }
);

// ============================================================
// Tool: project_list - Liệt kê tất cả projects
// ============================================================
server.tool(
  "project_list",
  "Liệt kê tất cả projects đã lưu trong bộ nhớ.",
  {},
  async () => {
    const projects = await vault.listProjects();
    return {
      content: [
        {
          type: "text" as const,
          text:
            projects.length > 0
              ? `📂 Projects (${projects.length}):\n${projects.map((p) => `- ${p}`).join("\n")}`
              : "Chưa có project nào được lưu.",
        },
      ],
    };
  }
);

// ============================================================
// Tool: context_update - Cập nhật context project
// ============================================================
server.tool(
  "context_update",
  `Cập nhật thông tin context của project (mô tả, tech stack, cấu trúc, ghi chú).
Dùng khi hiểu thêm về project hoặc có thay đổi quan trọng.`,
  {
    project: z.string().describe("Tên project"),
    section: z.string().describe("Tên section cần update (e.g. 'Mô tả dự án', 'Tech Stack', 'Cấu trúc chính')"),
    content: z.string().describe("Nội dung mới cho section"),
  },
  async ({ project, section, content }) => {
    await vault.ensureProject(project);
    const success = await vault.updateContext(project, section, content);
    return {
      content: [
        {
          type: "text" as const,
          text: success ? `✅ Đã cập nhật context: ${section}` : `❌ Lỗi cập nhật context`,
        },
      ],
    };
  }
);

// ============================================================
// Tool: progress_update - Cập nhật tiến độ
// ============================================================
server.tool(
  "progress_update",
  "Cập nhật tiến độ project: đang làm, đã xong, tiếp theo.",
  {
    project: z.string().describe("Tên project"),
    section: z.enum(["Đang làm", "Đã hoàn thành", "Tiếp theo"]).describe("Section cần update"),
    items: z.array(z.string()).describe("Danh sách items"),
  },
  async ({ project, section, items }) => {
    await vault.ensureProject(project);
    const success = await vault.updateProgress(project, section, items);
    return {
      content: [
        {
          type: "text" as const,
          text: success ? `✅ Đã cập nhật progress: ${section}` : `❌ Lỗi cập nhật progress`,
        },
      ],
    };
  }
);

// ============================================================
// Start server
// ============================================================
const transport = new StdioServerTransport();
await server.connect(transport);
