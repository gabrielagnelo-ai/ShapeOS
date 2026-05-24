-- CreateTable
CREATE TABLE "body_composition_snapshots" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "measured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weight_kg" DOUBLE PRECISION NOT NULL,
    "neck_cm" DOUBLE PRECISION,
    "waist_cm" DOUBLE PRECISION,
    "hip_cm" DOUBLE PRECISION,
    "body_fat_pct" DOUBLE PRECISION,
    "lean_mass_kg" DOUBLE PRECISION,
    "fat_mass_kg" DOUBLE PRECISION,
    "limitation" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "body_composition_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "body_composition_snapshots_user_id_measured_at_idx" ON "body_composition_snapshots"("user_id", "measured_at");

-- AddForeignKey
ALTER TABLE "body_composition_snapshots" ADD CONSTRAINT "body_composition_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
