import mongoose from "mongoose";

export const conversationMessageAggregation = ({
  conversationObjectId,
  userObjectId,
}: {
  conversationObjectId: mongoose.Types.ObjectId;
  userObjectId: mongoose.Types.ObjectId;
}) => {
  return [
    // Match messages for this specific conversation
    {
      $match: {
        conversation_id: conversationObjectId,
      },
    },
    // Add logic to check deletion status based on deleted_history
    {
      $addFields: {
        // Check if message is deleted for everyone
        deletedForEveryone: {
          $cond: {
            if: {
              $anyElementTrue: {
                $map: {
                  input: { $ifNull: ["$deleted_history", []] },
                  as: "deletion",
                  in: { $eq: ["$$deletion.deleted_for", "everyone"] },
                },
              },
            },
            then: true,
            else: false,
          },
        },
        // Determine if message should be hidden completely
        shouldHideMessage: {
          $cond: {
            if: {
              $anyElementTrue: {
                $map: {
                  input: { $ifNull: ["$deleted_history", []] },
                  as: "deletion",
                  in: {
                    $and: [
                      { $eq: ["$$deletion.deleted_for", "me"] },
                      { $eq: ["$$deletion.user_id", userObjectId] },
                    ],
                  },
                },
              },
            },
            then: true,
            else: false,
          },
        },
      },
    },
    // Filter out messages that are deleted for current user only
    {
      $match: {
        shouldHideMessage: false,
      },
    },
    // Populate sender information with only required fields
    {
      $lookup: {
        from: "users",
        localField: "sender",
        foreignField: "_id",
        as: "senderInfo",
        pipeline: [
          {
            $project: {
              _id: 1,
              uid: 1,
              name: 1,
              email: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: "$senderInfo",
    },
    // Populate reply_to information
    {
      $lookup: {
        from: "messages",
        localField: "reply_to",
        foreignField: "_id",
        as: "reply_to_info",
      },
    },
    // Populate sender info for reply_to message
    {
      $lookup: {
        from: "users",
        localField: "reply_to_info.sender",
        foreignField: "_id",
        as: "reply_to_sender_info",
        pipeline: [
          {
            $project: {
              _id: 1,
              uid: 1,
              name: 1,
              email: 1,
            },
          },
        ],
      },
    },
    // Populate reactions user info
    {
      $lookup: {
        from: "users",
        localField: "reactions.user_id",
        foreignField: "_id",
        as: "reaction_users",
        pipeline: [
          {
            $project: {
              _id: 1,
              uid: 1,
              name: 1,
              email: 1,
            },
          },
        ],
      },
    },
    // Build the final message structure with all required fields
    {
      $addFields: {
        // Display content logic
        content: {
          $cond: {
            if: "$deletedForEveryone",
            then: "This message was deleted",
            else: "$content",
          },
        },
        // Reply to information with sender details
        reply_to: {
          $cond: {
            if: { $gt: [{ $size: "$reply_to_info" }, 0] },
            then: {
              $let: {
                vars: {
                  replyMessage: { $arrayElemAt: ["$reply_to_info", 0] },
                  replySender: { $arrayElemAt: ["$reply_to_sender_info", 0] },
                },
                in: {
                  _id: "$$replyMessage._id",
                  content: "$$replyMessage.content",
                  type: "$$replyMessage.type",
                  sender: {
                    _id: "$$replySender._id",
                    uid: "$$replySender.uid",
                    name: "$$replySender.name",
                    email: "$$replySender.email",
                  },
                  createdAt: "$$replyMessage.createdAt",
                },
              },
            },
            else: null,
          },
        },
        // Map reactions with complete user info
        reactions: {
          $map: {
            input: { $ifNull: ["$reactions", []] },
            as: "reaction",
            in: {
              emoji: "$$reaction.emoji",
              reacted_at: "$$reaction.reacted_at",
              user: {
                $let: {
                  vars: {
                    reactionUser: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$reaction_users",
                            cond: { $eq: ["$$this._id", "$$reaction.user_id"] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                  in: {
                    _id: "$$reactionUser._id",
                    uid: "$$reactionUser.uid",
                    name: "$$reactionUser.name",
                    email: "$$reactionUser.email",
                  },
                },
              },
            },
          },
        },
        // Set sender to only include required fields
        sender: {
          _id: "$senderInfo._id",
          uid: "$senderInfo.uid",
          name: "$senderInfo.name",
          email: "$senderInfo.email",
        },
      },
    },
    // Final projection to include all required fields and exclude temporary ones
    {
      $project: {
        _id: 1,
        conversation_id: 1,
        sender: 1,
        type: 1,
        content: 1,
        status: 1,
        edited: 1,
        metadata: 1,
        deleted_history: 1,
        reactions: 1,
        reply_to: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ];
};
