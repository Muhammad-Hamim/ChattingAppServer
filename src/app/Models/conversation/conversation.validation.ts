import { z } from "zod";

// ============================
// REQUEST VALIDATION SCHEMAS
// ============================

// Validation for creating a DM conversation request
const createDMCRvalidation = z.object({
  body: z.object({
    receiverEmail: z
      .string()
      .email("Invalid email format")
      .min(1, "Receiver email is required"),
  }),
});

// Validation for responding to conversation request
const respondToConversationRequestSchema = z.object({
  body: z.object({
    action: z.enum(["accepted", "rejected"]),
    respondingUserId: z.string().min(1, "Responding user ID is required"),
  }),
});

// Validation for creating a group conversation
const createGroupConversationSchema = z.object({
  body: z.object({
    participantIds: z
      .array(z.string().min(1, "Each participant ID must be valid"))
      .min(1, "At least one participant ID is required")
      .max(50, "Maximum 50 participants allowed"),
    groupName: z
      .string()
      .min(1, "Group name is required")
      .max(100, "Group name must be less than 100 characters")
      .trim(),
    groupImage: z.string().url("Invalid image URL").optional(),
  }),
});

// Validation for getting user conversations
const getUserConversationsSchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().min(1, "Page must be at least 1")),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(
        z
          .number()
          .min(1, "Limit must be at least 1")
          .max(100, "Limit cannot exceed 100")
      ),
    status: z.enum(["pending", "accepted", "rejected"]).optional(),
    type: z.enum(["DM", "GROUP"]).optional(),
  }),
});

// Validation for getting conversations by ID
const getConversationByIdSchema = z.object({
  params: z.object({
    conversationId: z.string().min(1, "Conversation ID is required"),
  }),
});

// Validation for adding participant to conversation
const addParticipantSchema = z.object({
  params: z.object({
    conversationId: z.string().min(1, "Conversation ID is required"),
  }),
  body: z.object({
    userId: z.string().min(1, "User ID is required"),
    role: z.enum(["member", "admin"]).optional().default("member"),
  }),
});

// Validation for removing participant from conversation
const removeParticipantSchema = z.object({
  params: z.object({
    conversationId: z.string().min(1, "Conversation ID is required"),
    userId: z.string().min(1, "User ID is required"),
  }),
});

// Validation for updating group details
const updateGroupDetailsSchema = z.object({
  params: z.object({
    conversationId: z.string().min(1, "Conversation ID is required"),
  }),
  body: z
    .object({
      name: z
        .string()
        .min(1, "Group name is required")
        .max(100, "Group name must be less than 100 characters")
        .trim()
        .optional(),
      image: z.string().url("Invalid image URL").optional(),
    })
    .refine((data) => data.name !== undefined || data.image !== undefined, {
      message: "At least one field (name or image) must be provided",
    }),
});

// Validation for updating conversation status
const updateConversationStatusSchema = z.object({
  params: z.object({
    conversationId: z.string().min(1, "Conversation ID is required"),
  }),
  body: z.object({
    status: z.enum(["pending", "accepted", "rejected"]),
  }),
});

// Validation for searching conversations
const searchConversationsSchema = z.object({
  query: z.object({
    search: z.string().min(1, "Search term is required").trim(),
    type: z.enum(["DM", "GROUP"]).optional(),
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().min(1, "Page must be at least 1")),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(
        z
          .number()
          .min(1, "Limit must be at least 1")
          .max(50, "Limit cannot exceed 50")
      ),
  }),
});

// Validation for checking if DM exists between users
const checkDMExistsSchema = z.object({
  query: z.object({
    userId1: z.string().min(1, "First user ID is required"),
    userId2: z.string().min(1, "Second user ID is required"),
  }),
});

// Validation for getting conversations initiated by user
const getInitiatedConversationsSchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().min(1, "Page must be at least 1")),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(
        z
          .number()
          .min(1, "Limit must be at least 1")
          .max(100, "Limit cannot exceed 100")
      ),
  }),
});

// Export only request validation schemas
export const ConversationValidation = {
  createDMCRvalidation,
  respondToConversationRequestSchema,
  createGroupConversationSchema,
  getUserConversationsSchema,
  getConversationByIdSchema,
  addParticipantSchema,
  removeParticipantSchema,
  updateGroupDetailsSchema,
  updateConversationStatusSchema,
  searchConversationsSchema,
  checkDMExistsSchema,
  getInitiatedConversationsSchema,
};

// Type exports for TypeScript inference
export type CreateDMConversationRequest = z.infer<typeof createDMCRvalidation>;
export type RespondToConversationRequest = z.infer<
  typeof respondToConversationRequestSchema
>;
export type CreateGroupConversation = z.infer<
  typeof createGroupConversationSchema
>;
export type GetUserConversations = z.infer<typeof getUserConversationsSchema>;
export type GetConversationById = z.infer<typeof getConversationByIdSchema>;
export type AddParticipant = z.infer<typeof addParticipantSchema>;
export type RemoveParticipant = z.infer<typeof removeParticipantSchema>;
export type UpdateGroupDetails = z.infer<typeof updateGroupDetailsSchema>;
export type UpdateConversationStatus = z.infer<
  typeof updateConversationStatusSchema
>;
export type SearchConversations = z.infer<typeof searchConversationsSchema>;
export type CheckDMExists = z.infer<typeof checkDMExistsSchema>;
export type GetInitiatedConversations = z.infer<
  typeof getInitiatedConversationsSchema
>;
