-- CreateTable
CREATE TABLE "ContentTheme" (
    "id" TEXT NOT NULL,
    "serviceKey" TEXT NOT NULL,
    "themeKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL DEFAULT 'minio',
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentRouteRule" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "themeIds" JSONB NOT NULL DEFAULT '[]',
    "queueDepth" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentRouteRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentVideo" (
    "id" TEXT NOT NULL,
    "serviceKey" TEXT NOT NULL,
    "themeKey" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "minioKey" TEXT NOT NULL,
    "metadataKey" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "caption" TEXT NOT NULL DEFAULT '',
    "hashtags" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'ready',
    "sizeBytes" BIGINT,
    "lastModified" TIMESTAMP(3),
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentDelivery" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "phoneId" TEXT,
    "videoId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "publishedUrl" TEXT,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentTheme_serviceKey_themeKey_key" ON "ContentTheme"("serviceKey", "themeKey");
CREATE INDEX "ContentTheme_serviceKey_status_idx" ON "ContentTheme"("serviceKey", "status");
CREATE UNIQUE INDEX "ContentRouteRule_targetType_targetId_key" ON "ContentRouteRule"("targetType", "targetId");
CREATE INDEX "ContentRouteRule_targetType_status_idx" ON "ContentRouteRule"("targetType", "status");
CREATE UNIQUE INDEX "ContentVideo_bucket_minioKey_key" ON "ContentVideo"("bucket", "minioKey");
CREATE INDEX "ContentVideo_serviceKey_themeKey_status_idx" ON "ContentVideo"("serviceKey", "themeKey", "status");
CREATE INDEX "ContentVideo_status_updatedAt_idx" ON "ContentVideo"("status", "updatedAt");
CREATE UNIQUE INDEX "ContentDelivery_accountId_videoId_key" ON "ContentDelivery"("accountId", "videoId");
CREATE INDEX "ContentDelivery_accountId_status_idx" ON "ContentDelivery"("accountId", "status");
CREATE INDEX "ContentDelivery_videoId_status_idx" ON "ContentDelivery"("videoId", "status");

-- AddForeignKey
ALTER TABLE "ContentDelivery" ADD CONSTRAINT "ContentDelivery_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "ContentVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
