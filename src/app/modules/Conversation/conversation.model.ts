import { model, Schema } from "mongoose";
import { IConversation } from "./conversation.interface";

const conversationSchema = new Schema<IConversation>(
  {
    jobId: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    providerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastMessage: {
      type: String,
      default: null, // preview in conversation list
    },
    lastMessageAt: {
      type: Date,
      default: null, // sort conversations by latest
    },
    isActive: {
      type: Boolean,
      default: true, // false when job completed or cancelled
    },
    isDeleted: {
      type: Boolean,
      default: false, // false when job completed or cancelled
    },
  },
  {
    timestamps: true,
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
conversationSchema.index({ jobId: 1 });
conversationSchema.index({ customerId: 1 });
conversationSchema.index({ providerId: 1 });
conversationSchema.index({ lastMessageAt: -1 }); // sort by latest message
conversationSchema.index(
  // one conversation per job
  { jobId: 1, customerId: 1, providerId: 1 },
  { unique: true },
);

// ─── Model ───────────────────────────────────────────────────────────────────
export const ConversationModel = model<IConversation>(
  "Conversation",
  conversationSchema,
);
