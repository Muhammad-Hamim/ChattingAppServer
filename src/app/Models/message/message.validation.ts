import { z } from "zod";

const sendMessageValidationSchema = z.object({
  body: z.object({
    content: z
      .string({
        required_error: "Message content is required",
      })
      .min(1, "Message content cannot be empty")
      .max(5000, "Message content cannot exceed 5000 characters"),

    type: z
      .enum(["text", "image"], {
        invalid_type_error: "Message type must be either 'text' or 'image'",
      })
      .optional()
      .default("text"),

    replyTo: z
      .string({
        invalid_type_error: "Reply to must be a valid message ID",
      })
      .optional(),
  }),
});

const editMessageValidationSchema = z.object({
  body: z.object({
    content: z
      .string({
        required_error: "Message content is required",
      })
      .min(1, "Message content cannot be empty")
      .max(5000, "Message content cannot exceed 5000 characters"),
  }),
});

export const MessageValidation = {
  sendMessageValidationSchema,
  editMessageValidationSchema,
};
