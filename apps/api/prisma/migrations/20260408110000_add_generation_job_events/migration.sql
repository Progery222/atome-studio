CREATE TABLE "GenerationJobEvent" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "percent" INTEGER,
    "level" TEXT NOT NULL DEFAULT 'info',
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationJobEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GenerationJobEvent_jobId_seq_key" ON "GenerationJobEvent"("jobId", "seq");
CREATE INDEX "GenerationJobEvent_jobId_createdAt_idx" ON "GenerationJobEvent"("jobId", "createdAt");
CREATE INDEX "GenerationJobEvent_service_createdAt_idx" ON "GenerationJobEvent"("service", "createdAt");
