import { mutation } from "./_generated/server";

export const generateUploadUrl = mutation({
  args: {},
  handler: async () => "https://example.invalid/fake-upload-url",
});
