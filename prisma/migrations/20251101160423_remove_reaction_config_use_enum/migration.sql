-- Drop foreign key constraints
ALTER TABLE "reactions" DROP CONSTRAINT IF EXISTS "reactions_reaction_type_fkey";
ALTER TABLE "reaction_summaries" DROP CONSTRAINT IF EXISTS "reaction_summaries_reaction_type_fkey";
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_reaction_id_fkey";

-- Drop reactionId column from notifications if it exists
ALTER TABLE "notifications" DROP COLUMN IF EXISTS "reaction_id";

-- Convert reaction_type in reactions table from TEXT to ReactionType enum
ALTER TABLE "reactions"
  ALTER COLUMN "reaction_type" TYPE "ReactionType"
  USING CASE
    WHEN LOWER("reaction_type") = 'like' THEN 'LIKE'::"ReactionType"
    WHEN LOWER("reaction_type") = 'love' THEN 'LOVE'::"ReactionType"
    WHEN LOWER("reaction_type") = 'haha' THEN 'HAHA'::"ReactionType"
    WHEN LOWER("reaction_type") = 'wow' THEN 'WOW'::"ReactionType"
    WHEN LOWER("reaction_type") = 'sad' THEN 'SAD'::"ReactionType"
    WHEN LOWER("reaction_type") = 'angry' THEN 'ANGRY'::"ReactionType"
    ELSE 'LIKE'::"ReactionType"
  END;

-- Convert reaction_type in reaction_summaries table from TEXT to ReactionType enum
ALTER TABLE "reaction_summaries"
  ALTER COLUMN "reaction_type" TYPE "ReactionType"
  USING CASE
    WHEN LOWER("reaction_type") = 'like' THEN 'LIKE'::"ReactionType"
    WHEN LOWER("reaction_type") = 'love' THEN 'LOVE'::"ReactionType"
    WHEN LOWER("reaction_type") = 'haha' THEN 'HAHA'::"ReactionType"
    WHEN LOWER("reaction_type") = 'wow' THEN 'WOW'::"ReactionType"
    WHEN LOWER("reaction_type") = 'sad' THEN 'SAD'::"ReactionType"
    WHEN LOWER("reaction_type") = 'angry' THEN 'ANGRY'::"ReactionType"
    ELSE 'LIKE'::"ReactionType"
  END;

-- Drop reaction_configs table
DROP TABLE IF EXISTS "reaction_configs";
