-- AlterTable
-- 新增 tokenVersion 字段，用于吊销/单次使用 refreshToken（登出/刷新时递增）
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
