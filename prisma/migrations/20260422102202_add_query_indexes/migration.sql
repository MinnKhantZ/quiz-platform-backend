-- CreateIndex
CREATE INDEX "Answer_attemptId_idx" ON "Answer"("attemptId");

-- CreateIndex
CREATE INDEX "Answer_questionId_idx" ON "Answer"("questionId");

-- CreateIndex
CREATE INDEX "Attempt_quizId_completedAt_idx" ON "Attempt"("quizId", "completedAt");

-- CreateIndex
CREATE INDEX "Attempt_studentId_completedAt_idx" ON "Attempt"("studentId", "completedAt");

-- CreateIndex
CREATE INDEX "Attempt_quizId_studentId_idx" ON "Attempt"("quizId", "studentId");

-- CreateIndex
CREATE INDEX "LiveSession_quizId_status_idx" ON "LiveSession"("quizId", "status");

-- CreateIndex
CREATE INDEX "LiveSession_teacherId_status_idx" ON "LiveSession"("teacherId", "status");

-- CreateIndex
CREATE INDEX "Question_quizId_order_idx" ON "Question"("quizId", "order");

-- CreateIndex
CREATE INDEX "Quiz_teacherId_idx" ON "Quiz"("teacherId");

-- CreateIndex
CREATE INDEX "Quiz_isPublished_createdAt_idx" ON "Quiz"("isPublished", "createdAt");
