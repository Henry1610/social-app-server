-- CreateTable
CREATE TABLE "public"."otp_verifications" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "otp" VARCHAR(10) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "otp_verifications_email_idx" ON "public"."otp_verifications"("email");

-- CreateIndex
CREATE INDEX "otp_verifications_otp_idx" ON "public"."otp_verifications"("otp");

-- CreateIndex
CREATE INDEX "otp_verifications_expires_at_idx" ON "public"."otp_verifications"("expires_at");
