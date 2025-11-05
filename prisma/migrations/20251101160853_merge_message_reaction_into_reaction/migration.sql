-- Drop foreign key constraints for message_reactions (if exists)
DO $$ 
BEGIN
ALTER TABLE "message_reactions" DROP CONSTRAINT IF EXISTS "message_reactions_message_id_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

DO $$ 
BEGIN
ALTER TABLE "message_reactions" DROP CONSTRAINT IF EXISTS "message_reactions_user_id_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- Migrate data from message_reactions to reactions (if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'message_reactions') THEN
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
  END IF;
END $$;

-- Drop message_reactions table (if exists)
DROP TABLE IF EXISTS "message_reactions";

