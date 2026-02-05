-- CreateTable
CREATE TABLE "DashboardShare" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "workouts" BOOLEAN NOT NULL DEFAULT false,
    "wellness" BOOLEAN NOT NULL DEFAULT false,
    "nutrition" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DashboardShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DashboardShare_ownerId_viewerId_key" ON "DashboardShare"("ownerId", "viewerId");

-- AddForeignKey
ALTER TABLE "DashboardShare"
    ADD CONSTRAINT "DashboardShare_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DashboardShare"
    ADD CONSTRAINT "DashboardShare_viewerId_fkey"
    FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
