-- CreateTable
CREATE TABLE "GenerationJobLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "videosCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationJobLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GenerationJobLog_jobId_key" ON "GenerationJobLog"("jobId");

-- CreateIndex
CREATE INDEX "GenerationJobLog_service_createdAt_idx" ON "GenerationJobLog"("service", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationJobLog_status_createdAt_idx" ON "GenerationJobLog"("status", "createdAt");
