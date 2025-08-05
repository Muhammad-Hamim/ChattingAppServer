export interface ServerToClientEvents {
  // User events
  "user-status-changed": (data: {
    _id?: string;
    uid: string;
    name: string;
    email: string;
    status: "online" | "offline";
    lastSeen: Date;
    conversationId?: string;
  }) => void;

  welcome: (data: {
    message: string;
    socketId: string;
    name: string;
    status?: string;
  }) => void;

  // Message events
  "new-message": (data: {
    message: Record<string, unknown>;
    conversationId: string;
  }) => void;

  "message-edited": (data: {
    messageId: string;
    newContent: string;
    editedAt: Date;
    conversationId: string;
  }) => void;

  "message-deleted-everyone": (data: {
    messageId: string;
    conversationId: string;
    deletedAt: Date;
  }) => void;

  "reaction-added": (data: {
    messageId: string;
    userId: string;
    emoji: string;
    conversationId: string;
    reactedAt: Date;
  }) => void;

  "reaction-removed": (data: {
    messageId: string;
    userId: string;
    emoji: string;
    conversationId: string;
  }) => void;

  // Conversation events
  "conversation-created": (data: {
    conversation: Record<string, unknown>;
    participants: string[];
  }) => void;

  "conversation-updated": (data: {
    conversationId: string;
    updates: Record<string, unknown>;
  }) => void;

  "typing-start": (data: {
    conversationId: string;
    userId: string;
    userName: string;
  }) => void;

  "typing-stop": (data: { conversationId: string; userId: string }) => void;
}

export interface ClientToServerEvents {
  // User events
  "update-status": (data: { status: "online" | "offline" }) => void;

  // Message events
  "send-message": (
    data: {
      conversationId: string;
      content: string;
      type?: string;
      caption?: string;
      replyTo?: string;
      metadata?: Record<string, unknown>;
    },
    callback?: (response: {
      success: boolean;
      message?: string;
      error?: string;
    }) => void
  ) => void;

  "edit-message": (
    data: {
      messageId: string;
      newContent: string;
    },
    callback?: (response: {
      success: boolean;
      message?: string;
      error?: string;
    }) => void
  ) => void;

  "delete-message-everyone": (
    data: {
      messageId: string;
    },
    callback?: (response: {
      success: boolean;
      message?: string;
      error?: string;
    }) => void
  ) => void;

  "delete-message-me": (
    data: {
      messageId: string;
    },
    callback?: (response: {
      success: boolean;
      message?: string;
      error?: string;
    }) => void
  ) => void;

  "add-reaction": (
    data: {
      messageId: string;
      emoji: string;
    },
    callback?: (response: {
      success: boolean;
      message?: string;
      error?: string;
    }) => void
  ) => void;

  "remove-reaction": (
    data: {
      messageId: string;
      emoji: string;
    },
    callback?: (response: {
      success: boolean;
      message?: string;
      error?: string;
    }) => void
  ) => void;

  // Conversation events
  "join-conversation": (data: { conversationId: string }) => void;
  "leave-conversation": (data: { conversationId: string }) => void;
  "typing-start": (data: { conversationId: string }) => void;
  "typing-stop": (data: { conversationId: string }) => void;
}
