import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export const mistakeRecords = sqliteTable("mistake_records", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  problemText: text("problem_text").notNull(),
  problemImage: text("problem_image"),
  userAnswer: text("user_answer").notNull(),
  correctAnswer: text("correct_answer").notNull(),
  analysis: text("analysis"),
  tags: text("tags"),
  subject: text("subject"),
  isReviewed: integer("is_reviewed", { mode: "boolean" }).default(false),
  reviewCount: integer("review_count").default(0),
  lastReviewedAt: integer("last_reviewed_at"),
  createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at").notNull().$defaultFn(() => Date.now()),
});

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  type: text("type").notNull(),
  title: text("title").notNull(),
  messages: text("messages").notNull(),
  createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at").notNull().$defaultFn(() => Date.now()),
});

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;

export type MistakeRecord = typeof mistakeRecords.$inferSelect;
export type NewMistakeRecord = typeof mistakeRecords.$inferInsert;
