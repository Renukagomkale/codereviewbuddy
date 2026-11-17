const { Schema, model } = require("mongoose");

const reviewRunSchema = new Schema(
  {
    repo: { type: Schema.Types.ObjectId, ref: "Repo", required: true, index: true },
    prNumber: { type: Number, required: true },
    headSha: { type: String, required: true },
    deliveryId: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["queued", "running", "done", "failed"],
      default: "queued",
    },
    findingsCount: { type: Number, default: 0 },
    durationMs: Number,
    error: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = model("ReviewRun", reviewRunSchema);
