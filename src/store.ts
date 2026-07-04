import fs from "node:fs/promises";
import path from "node:path";
import { MappingFile, RoomMapping } from "./types.js";

const EMPTY_DB: MappingFile = { rooms: {} };

function sanitizeToken(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function sanitizeTopic(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
}

export class MappingStore {
  private readonly filePath: string;

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, "room-mappings.json");
  }

  private async readDb(): Promise<MappingFile> {
    try {
      const content = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(content) as MappingFile;
      if (!parsed.rooms || typeof parsed.rooms !== "object") {
        return EMPTY_DB;
      }
      return parsed;
    } catch {
      return EMPTY_DB;
    }
  }

  private async writeDb(db: MappingFile): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
  }

  async ensureRoom(roomToken: string): Promise<RoomMapping> {
    const db = await this.readDb();
    const existing = db.rooms[roomToken];
    if (existing) {
      return existing;
    }

    const sanitized = sanitizeToken(roomToken);
    const mapping: RoomMapping = {
      roomToken,
      defaultConversationId: `nextcloud-talk-${sanitized}`,
      topics: {},
      updatedAt: new Date().toISOString()
    };
    db.rooms[roomToken] = mapping;
    await this.writeDb(db);
    return mapping;
  }

  async conversationFor(roomToken: string, topicKey?: string): Promise<string> {
    const mapping = await this.ensureRoom(roomToken);
    if (!topicKey) {
      return mapping.defaultConversationId;
    }

    const normalized = sanitizeTopic(topicKey);
    if (!normalized) {
      return mapping.defaultConversationId;
    }

    if (!mapping.topics[normalized]) {
      const db = await this.readDb();
      const room = db.rooms[roomToken] ?? mapping;
      room.topics[normalized] = `${room.defaultConversationId}-topic-${normalized}`;
      room.updatedAt = new Date().toISOString();
      db.rooms[roomToken] = room;
      await this.writeDb(db);
      return room.topics[normalized];
    }

    return mapping.topics[normalized];
  }
}
