-- CreateTable
CREATE TABLE "Share" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "prefsKey" TEXT NOT NULL,
    "prefs" JSONB NOT NULL,
    "contributions" JSONB NOT NULL,
    "total" INTEGER NOT NULL,
    "streak" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Share_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Share_updatedAt_idx" ON "Share"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Share_handle_prefsKey_key" ON "Share"("handle", "prefsKey");
