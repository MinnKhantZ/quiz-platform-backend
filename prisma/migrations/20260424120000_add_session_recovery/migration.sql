-- AlterTable: add result-visibility flags to LiveSession
ALTER TABLE "LiveSession" ADD COLUMN "showLeaderboard" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LiveSession" ADD COLUMN "showResults" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: participant presence tracking
CREATE TABLE "LiveParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "online" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "LiveParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveParticipant_sessionId_idx" ON "LiveParticipant"("sessionId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "LiveParticipant_sessionId_studentId_key" ON "LiveParticipant"("sessionId", "studentId");

-- AddForeignKey
ALTER TABLE "LiveParticipant" ADD CONSTRAINT "LiveParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
