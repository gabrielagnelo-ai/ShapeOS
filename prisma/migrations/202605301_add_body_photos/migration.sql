CREATE TABLE "body_photos" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "weekly_checkin_id" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "image_mime_type" TEXT NOT NULL,
  "image_data" BYTEA NOT NULL,
  "pose" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "body_photos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "body_photos_user_id_weekly_checkin_id_idx" ON "body_photos"("user_id", "weekly_checkin_id");

ALTER TABLE "body_photos"
ADD CONSTRAINT "body_photos_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "body_photos"
ADD CONSTRAINT "body_photos_weekly_checkin_id_fkey"
FOREIGN KEY ("weekly_checkin_id") REFERENCES "weekly_checkins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
