-- Post likes and comments support.

CREATE TABLE IF NOT EXISTS "post_like" (
  "id" TEXT PRIMARY KEY,
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "post_like_postId_userId_key"
  ON "post_like"("postId", "userId");

CREATE INDEX IF NOT EXISTS "post_like_userId_idx"
  ON "post_like"("userId");

ALTER TABLE "post_like"
  ADD CONSTRAINT "post_like_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE;

ALTER TABLE "post_like"
  ADD CONSTRAINT "post_like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS "post_comment" (
  "id" TEXT PRIMARY KEY,
  "postId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "post_comment_postId_idx"
  ON "post_comment"("postId");

CREATE INDEX IF NOT EXISTS "post_comment_authorId_idx"
  ON "post_comment"("authorId");

ALTER TABLE "post_comment"
  ADD CONSTRAINT "post_comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE;

ALTER TABLE "post_comment"
  ADD CONSTRAINT "post_comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE;

