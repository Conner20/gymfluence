-- CreateTable
CREATE TABLE "NutritionSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalKcal" DOUBLE PRECISION NOT NULL DEFAULT 2800,
    "goalProtein" DOUBLE PRECISION NOT NULL DEFAULT 200,
    "goalFat" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "goalCarb" DOUBLE PRECISION NOT NULL DEFAULT 300,
    "heatmapLevels" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NutritionSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NutritionSettings_userId_key" ON "NutritionSettings"("userId");

-- AddForeignKey
ALTER TABLE "NutritionSettings"
ADD CONSTRAINT "NutritionSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
