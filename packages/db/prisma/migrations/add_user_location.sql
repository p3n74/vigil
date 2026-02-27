-- Add user_location table for storing last-known GPS coordinates
CREATE TABLE IF NOT EXISTS "user_location" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_location_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_location_userId_key" ON "user_location"("userId");
CREATE INDEX IF NOT EXISTS "user_location_updatedAt_idx" ON "user_location"("updatedAt");

ALTER TABLE "user_location"
    ADD CONSTRAINT "user_location_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
