import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const searchAll = asyncHandler(async (req, res) => {
    const { q } = req.query;
    if (!q || !q.trim()) {
      throw new ApiError(400, "Search query is required");
    }
  
    // Find videos by title
    const videos = await Video.find({
      title: { $regex: q, $options: 'i' }
    }).select('-videoFile');
  
    // Find users by username
    const users = await User.find({
      username: { $regex: q, $options: 'i' }
    }).select('username avatar bio fullName');
  
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { videos, users },
          "Search results fetched successfully"
        )
      );
});

export { searchAll };