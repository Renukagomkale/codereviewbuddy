const { Schema, model } = require("mongoose");

const findingSchema = new Schema(
  {
    run: { type: Schema.Types.ObjectId, ref: "ReviewRun", required: true, index: true },
    path: { type: String, required: true },
    line: { type: Number, required: true },
    ruleId: { type: String, required: true },
    severity: { type: String, enum: ["low", "medium", "high"], required: true },
    message: { type: String, required: true },
    fingerprint: { type: String, required: true },
    posted: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = model("Finding", findingSchema);
