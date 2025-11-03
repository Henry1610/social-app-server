-- Drop foreign key constraints for message_reactions
ALTER TABLE "message_reactions" DROP CONSTRAINT IF EXISTS "message_reactions_message_id_fkey";
ALTER TABLE "message_reactions" DROP CONSTRAINT IF EXISTS "message_reactions_user_id_fkey";

-- Migrate data from message_reactions to reactions
-- Chuyển tất cả message_reactions sang reactions với targetType='MESSAGE' và reactionType='LIKE'
INSERT INTO "reactions" ("user_id", "target_type", "target_id", "reaction_type", "created_at", "updated_at")
SELECT 
  "user_id",
  'MESSAGE'::"TargetType",
  "message_id",
  'LIKE'::"ReactionType",
  "created_at",
  NOW()
FROM "message_reactions"
WHERE NOT EXISTS (
  SELECT 1 FROM "reactions" r
  WHERE r.user_id = "message_reactions".user_id
    AND r.target_type = 'MESSAGE'
    AND r.target_id = "message_reactions".message_id
)
ON CONFLICT DO NOTHING;

-- Drop message_reactions table
DROP TABLE IF EXISTS "message_reactions";

