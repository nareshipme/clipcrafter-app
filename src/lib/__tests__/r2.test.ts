import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Feature, Scenario } from "@/test/bdd";

// Mock AWS SDK so we don't need real R2 credentials
const mockGetSignedUrl = vi.fn().mockResolvedValue("https://r2.example.com/signed?sig=test");

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({})),
  PutObjectCommand: vi.fn(),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mockGetSignedUrl,
}));

Feature("R2 Presigned Upload URL", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("R2_ACCESS_KEY_ID", "test-key-id");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret");
    vi.stubEnv("R2_ENDPOINT", "https://r2.example.com");
    vi.stubEnv("R2_BUCKET_NAME", "test-bucket");
    mockGetSignedUrl.mockResolvedValue("https://r2.example.com/signed?sig=test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  Scenario("Generate presigned URL for video upload", () => {
    it("Given a valid filename and userId, Then it returns a presigned URL object", async () => {
      const { getPresignedUploadUrl } = await import("@/lib/r2");
      const result = await getPresignedUploadUrl("video.mp4", "user_123");

      expect(result.uploadUrl).toBe("https://r2.example.com/signed?sig=test");
      expect(result.key).toMatch(/^uploads\/user_123\/.+\.mp4$/);
      expect(result.publicUrl).toContain("mp4");
    });

    it("Given a .mov file, Then key uses mov extension", async () => {
      const { getPresignedUploadUrl } = await import("@/lib/r2");
      const result = await getPresignedUploadUrl("clip.mov", "user_abc");

      expect(result.key).toMatch(/\.mov$/);
    });

    it("Given a missing filename, Then it throws a validation error", async () => {
      const { getPresignedUploadUrl } = await import("@/lib/r2");
      await expect(getPresignedUploadUrl("", "user123")).rejects.toThrow("filename is required");
    });

    it("Given a missing userId, Then it throws a validation error", async () => {
      const { getPresignedUploadUrl } = await import("@/lib/r2");
      await expect(getPresignedUploadUrl("video.mp4", "")).rejects.toThrow("userId is required");
    });
  });
});
