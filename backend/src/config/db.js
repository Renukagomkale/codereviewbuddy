const mongoose = require("mongoose");
const Repo = require("../models/Repo");
const ReviewRun = require("../models/ReviewRun");
const User = require("../models/User");

async function connectDb(uri) {
  await mongoose.connect(uri);
  await Promise.all([Repo.init(), ReviewRun.init(), User.init()]);
  console.log("MongoDB connected");
}

module.exports = { connectDb };
