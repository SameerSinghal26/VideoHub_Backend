import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { Like } from "../models/like.model.js";

//done...

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  // TODO: get video, upload to cloudinary, create video

  if ([title, description].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required!");
  }

  const videolocalPath = req.files?.videoFile[0]?.path;

  if (!videolocalPath) {
    throw new ApiError(400, "Video file is required!");
  }

  const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

  if (!thumbnailLocalPath) {
    throw new ApiError(400, "Thumbnail file is required!");
  }

  // uplaoding video and thumbnail to cloudinary
  const videoFile = await uploadOnCloudinary(videolocalPath);
  const thumbnailFile = await uploadOnCloudinary(thumbnailLocalPath);

  const video = await Video.create({
    videoFile: videoFile.url,
    thumbnail: thumbnailFile.url,
    publicId: videoFile.public_id,
    title,
    description,
    duration: videoFile.duration,
    owner: req.user?._id,
  });

  const videoUploaded = await Video.findById(video?._id).select(
    "-videoFile -thumbnail -views -isPublished"
  );

  if (!videoUploaded) {
    throw new ApiError(500, "Something went wrong while uploading the video!");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, videoUploaded, "Video uploaded successfully!"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid video id!");
  }

  const user = await User.findById(req.user._id);

  let video;

  // If user hasn't watched before, increment view and add to history
  if (!user.watchHistory.includes(videoId)) {
    video = await Video.findByIdAndUpdate(
      videoId,
      { $inc: { view: 1 } },
      { new: true }
    );
  } else {
    // If already watched, just fetch video (no view increment)
    video = await Video.findById(videoId);
  }

  if (!video) {
    throw new ApiError(404, "Video not found!");
  }

  // Always add to watchHistory (duplicates allowed)
  if (
    user.watchHistory.length === 0 ||
    user.watchHistory[user.watchHistory.length - 1].toString() !== videoId
  ) {
    await User.findByIdAndUpdate(req.user._id, {
      $push: { watchHistory: videoId },
    });
  }

  // Get total likes for the video
  const totalLikes = await Like.countDocuments({ video: videoId });

  // Add totalLikes to the video object
  const videoWithLikes = { ...video.toObject(), totalLikes };

  return res
    .status(200)
    .json(new ApiResponse(200, videoWithLikes, "Video fetched successfully!"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: update video details like title, description, thumbnail
  const { title, description } = req.body;

  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid video id!");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found!");
  }

  // Handle video file update if provided
  if (req.files?.videoFile?.[0]?.path) {
    const publicId = video?.publicId;
    if (!publicId) {
      throw new ApiError(400, "publicId is required!");
    }

    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: "video" });
    } catch (error) {
      throw new ApiError(
        400,
        "error while deleting the video file from cloudinary to update new video file!"
      );
    }

    const videolocalPath = req.files.videoFile[0].path;
    const newVideo = await uploadOnCloudinary(videolocalPath);

    if (!newVideo) {
      throw new ApiError(
        400,
        "Something went wrong while uploading the video!"
      );
    }

    video.videoFile = newVideo.url;
    video.publicId = newVideo.public_id;
    video.duration = newVideo.duration;
  }

  // Handle thumbnail update if provided
  if (req.files?.thumbnail?.[0]?.path) {
    const thumbnailLocalPath = req.files.thumbnail[0].path;
    const newThumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!newThumbnail) {
      throw new ApiError(
        400,
        "Something went wrong while uploading the thumbnail!"
      );
    }

    // Delete old thumbnail from cloudinary if it exists
    if (video.thumbnail) {
      try {
        await cloudinary.uploader.destroy(
          video.thumbnail.split("/").pop().split(".")[0]
        );
      } catch (error) {
        console.log("Error deleting old thumbnail:", error);
      }
    }

    video.thumbnail = newThumbnail.url;
  }

  // Update title and description if provided
  if (title) video.title = title;
  if (description) video.description = description;

  const updatedVideo = await video.save();

  return res
    .status(200)
    .json(new ApiResponse(200, updatedVideo, "Video updated successfully!"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid video id!");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found!");
  }

  const publicId = video?.publicId;

  if (publicId) {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: "video" });
    } catch (error) {
      throw new ApiError(400, "Error deleting video file from Cloudinary!");
    }
  }

  // 🛠️ Delete from DB as well!
  const deletefromDatabase = await Video.findByIdAndDelete(videoId);

  if (!deletefromDatabase) {
    throw new ApiError(
      404,
      "Something goes wrong will deleting the video from Database!!!"
    );
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video deleted successfully!"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const video = await Video.findById(videoId);

  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(
      400,
      "videoId is not correct to Toggle publish status of video"
    );
  }

  //toggle the ispublished --> if true then false if false then true
  video.isPublished = !video.isPublished;

  const publishStatus = await Video.findByIdAndUpdate(
    videoId,
    {
      isPublished: video.isPublished,
    },
    {
      new: true,
    }
  ).select("-video -thumbnail -title -description -views -duration -owner");

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        publishStatus,
        "If your video was published then now unpublish And if It was unpublished then now published !"
      )
    );
});

// Add this new function to get all videos
const getAllVideos = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    query,
    sortBy = "createdAt",
    sortType = "desc",
    category,
  } = req.query;

  const pageNumber = parseInt(page);
  const pageLimit = parseInt(limit);
  const skip = (pageNumber - 1) * pageLimit;
  const sortDirection = sortType === "asc" ? 1 : -1;

  try {
    const matchStage = {
      isPublished: true, // Only fetch published videos
    };

    // Optional search by title or description
    if (query) {
      matchStage.$or = [
        { title: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
      ];
    }

    // Optional category filter (if you're using it)
    if (category) {
      matchStage.category = category;
    }

    const aggregationPipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "owner",
          pipeline: [
            {
              $project: {
                username: 1,
                fullName: 1,
                avatar: 1,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          owner: { $arrayElemAt: ["$owner", 0] },
        },
      },
      {
        $sort: {
          [sortBy]: sortDirection,
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: pageLimit,
      },
    ];

    const videos = await Video.aggregate(aggregationPipeline);

    const totalVideos = await Video.countDocuments(matchStage);
    const totalPages = Math.ceil(totalVideos / pageLimit);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          videos,
          totalVideos,
          totalPages,
          currentPage: pageNumber,
          hasMore: pageNumber < totalPages,
        },
        "Videos fetched successfully in descending order."
      )
    );
  } catch (error) {
    throw new ApiError(500, "Failed to fetch videos.");
  }
});

const getUserVideos = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user id!");
  }

  const pageNumber = parseInt(page);
  const pageLimit = parseInt(limit);
  const skip = (pageNumber - 1) * pageLimit;

  try {
    const matchStage = {
      owner: new mongoose.Types.ObjectId(userId),
      isPublished: true
    };

    const aggregationPipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "owner",
          pipeline: [
            {
              $project: {
                username: 1,
                fullName: 1,
                avatar: 1,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          owner: { $arrayElemAt: ["$owner", 0] },
        },
      },
      {
        $sort: {
          createdAt: -1
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: pageLimit,
      },
    ];

    const videos = await Video.aggregate(aggregationPipeline);
    const totalVideos = await Video.countDocuments(matchStage);
    const totalPages = Math.ceil(totalVideos / pageLimit);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          videos,
          totalVideos,
          totalPages,
          currentPage: pageNumber,
          hasMore: pageNumber < totalPages,
        },
        "User videos fetched successfully"
      )
    );
  } catch (error) {
    throw new ApiError(500, "Failed to fetch user videos");
  }
});

const searchVideos = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.status(400).json({ message: "Search query is required" });
  }
  // Search by title or description (case-insensitive)
  const videos = await Video.find({
    $or: [
      { title: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } }
    ]
  }).select('-videoFile');
  res.json({ data: videos });
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
  getUserVideos,
  searchVideos,
};
