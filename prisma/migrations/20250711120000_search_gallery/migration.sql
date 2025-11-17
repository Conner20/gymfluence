-- CreateTable
CREATE TABLE "SearchGalleryImage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SearchGalleryImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchGalleryImage_userId_idx" ON "SearchGalleryImage"("userId");

-- AddForeignKey
ALTER TABLE "SearchGalleryImage"
ADD CONSTRAINT "SearchGalleryImage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
