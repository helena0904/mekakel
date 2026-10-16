-- CreateTable
CREATE TABLE "RevokedToken" (
    "id" SERIAL NOT NULL,
    "jti" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevokedToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RevokedToken_jti_key" ON "RevokedToken"("jti");

-- CreateIndex
CREATE INDEX "RevokedToken_expiresAt_idx" ON "RevokedToken"("expiresAt");

-- CreateTable
CREATE TABLE "RateLimitCounter" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitCounter_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RateLimitCounter_expiresAt_idx" ON "RateLimitCounter"("expiresAt");
