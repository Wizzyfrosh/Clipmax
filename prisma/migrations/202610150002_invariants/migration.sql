CREATE UNIQUE INDEX "Upload_one_active_project" ON "Upload" ("projectId") WHERE state = 'active';
ALTER TABLE "Quota" ADD CONSTRAINT "Quota_nonnegative" CHECK (allowance >= 0 AND reserved >= 0 AND consumed >= 0 AND reserved + consumed <= allowance);
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_valid_range" CHECK ("startMs" >= 0 AND "endMs" - "startMs" BETWEEN 20000 AND 60000);
ALTER TABLE "Project" ADD CONSTRAINT "Project_clip_count" CHECK ("clipCount" BETWEEN 1 AND 5);
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_valid_size" CHECK (size > 0 AND size <= 500000000 AND "partSize" > 0);
CREATE INDEX "Job_active_lease" ON "Job" ("leaseUntil") WHERE status = 'running';
