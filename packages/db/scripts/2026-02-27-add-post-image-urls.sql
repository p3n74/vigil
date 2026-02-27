-- Add support for multi-image posts while keeping existing cover image behavior.
ALTER TABLE "post"
ADD COLUMN IF NOT EXISTS "imageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill existing rows so each current post has one gallery image.
UPDATE "post"
SET "imageUrls" = ARRAY["imageUrl"]
WHERE cardinality("imageUrls") = 0;
