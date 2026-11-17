const { Schema, model } = require("mongoose");

const repoSchema = new Schema(
  {
    fullName: { type: String, required: true, unique: true },
    owner: { type: String, required: true },
    name: { type: String, required: true },
    installationId: Number,
    user: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    disabledRules: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = model("Repo", repoSchema);
