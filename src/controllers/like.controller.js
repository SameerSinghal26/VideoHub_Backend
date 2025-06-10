import mongoose from "mongoose"
import {Like} from "../models/like.model.js"
import {Video} from "../models/video.model.js"
import {Comment} from "../models/comment.model.js"
import {Subscription} from "../models/subscription.model.js"
import {Playlist} from "../models/playlist.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
        throw new ApiError(401, "User not authenticated");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    const existingLike = await Like.findOne({
        video: videoId,
        likedBy: userId
    });

    let likedVideosPlaylist = await Playlist.findOne({
        owner: userId,
        name: "Liked Videos"
    });

    if (existingLike) {
        // Unlike video
        await Like.findByIdAndDelete(existingLike._id);
        
        // Remove from Liked Videos playlist if it exists
        if (likedVideosPlaylist) {
            await Playlist.findByIdAndUpdate(
                likedVideosPlaylist._id,
                {
                    $pull: { videos: videoId }
                }
            );
        }

        return res
            .status(200)
            .json(
                new ApiResponse(200, { isLiked: false, totalLikes: video.totalLikes - 1 }, "Video unliked successfully")
            );
    }

    // Like video
    const newLike = await Like.create({
        video: videoId,
        likedBy: userId
    });

    // Add to Liked Videos playlist
    if (!likedVideosPlaylist) {
        // Create Liked Videos playlist if it doesn't exist
        likedVideosPlaylist = await Playlist.create({
            name: "Liked Videos",
            description: "Videos you have liked",
            owner: userId,
            videos: [videoId]
        });
    } else {
        // Add video to the beginning of the playlist
        await Playlist.findByIdAndUpdate(
            likedVideosPlaylist._id,
            {
                $push: {
                    videos: {
                        $each: [videoId],
                        $position: 0  // Add at the beginning
                    }
                }
            }
        );
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, { isLiked: true, totalLikes: video.totalLikes + 1 }, "Video liked successfully")
        );
});

const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    try {
        const user = req.user?._id;
        const condition = {likedBy: user, comment: commentId};
        const like = await Like.findOne(condition);
        
        if(!like){
            const newLike = await Like.create({
                comment: commentId,
                likedBy: user
            });
            return res
            .status(200)
            .json(new ApiResponse(200, { newLike, isLiked: true }, "Comment liked Successfully"));
        }
        else{
            const removeLike = await Like.findOneAndDelete(like._id);
            return res
            .status(200)
            .json(new ApiResponse(200, {removeLike, isLiked: false }, "Comment unliked Successfully"));
        }
    } catch (error) {
        throw new ApiError(500, "Something went wrong while toggling like on comment");
    }
})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    //TODO: toggle like on tweet
    try {
        const user = req.user?._id;
        const condition = {likedBy: user, tweet: tweetId};
        const like = await Like.findOne(condition);
        
        if(!like){
            const newLike = await Like.create({
                tweet: tweetId,
                likedBy: user
            });
            return res
            .status(200)
            .json(new ApiResponse(200, { newLike, isLiked: true }, "Tweet liked Successfully"));
        }
        else{
            const removeLike = await Like.findOneAndDelete(like._id);
            return res
            .status(200)
            .json(new ApiResponse(200, { removeLike, isLiked: false }, "Tweet unliked Successfully"));
        }
    } catch (error) {
        throw new ApiError(500, "Something went wrong while toggling like on tweet");
    }
})

const getLikedVideos = asyncHandler(async (req, res) => {
    //TODO: get all liked videos
    try {
        const user = req.user?._id;        
        const likedVideos = await Like.find({
            likedBy: user,
            video: { $exists: true } // Only get likes where video field exists
        })
        .populate({
            path: "video",
            select: "videoFile thumbnail title description duration view owner updatedAt createdAt",
            populate: {
                path: "owner",
                select: "username fullName avatar"
            }
        })
        .sort({ updatedAt: -1, createdAt: -1 });

        if(!likedVideos || likedVideos.length === 0){
            return res
            .status(200)
            .json(new ApiResponse(200, [], "No liked videos found"));
        }

        // Add totalLikes to each video
        const videos = await Promise.all(
          likedVideos.map(async (like) => {
            const video = like.video.toObject();
            video.totalLikes = await Like.countDocuments({ video: video._id });
            return video;
          })
        );
        
        return res
        .status(200)
        .json(new ApiResponse(200, videos, "Liked videos fetched Successfully"));
    } catch (error) {
        throw new ApiError(500, "Something went wrong while fetching liked videos");
    }
})

const checkVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
        throw new ApiError(401, "User not authenticated");
    }

    const existingLike = await Like.findOne({
        video: videoId,
        likedBy: userId
    });

    return res
        .status(200)
        .json(
            new ApiResponse(200, { isLiked: !!existingLike }, "Video like status fetched successfully")
        );
});

const checkCommentLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
        throw new ApiError(401, "User not authenticated");
    }

    const existingLike = await Like.findOne({
        comment: commentId,
        likedBy: userId
    });

    return res
        .status(200)
        .json(
            new ApiResponse(200, { isLiked: !!existingLike }, "Comment like status fetched successfully")
        );
});

const checkTweetLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
        throw new ApiError(401, "User not authenticated");
    }

    const existingLike = await Like.findOne({
        tweet: tweetId,
        likedBy: userId
    });

    return res
        .status(200)
        .json(
            new ApiResponse(200, { isLiked: !!existingLike }, "Tweet like status fetched successfully")
        );
});

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos,
    checkVideoLike,
    checkCommentLike,
    checkTweetLike
}