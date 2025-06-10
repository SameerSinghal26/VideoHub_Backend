import mongoose from "mongoose"
import {Comment} from "../models/comment.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getVideoComments = asyncHandler(async (req, res) => {
    const {videoId} = req.params

    if (!mongoose.Types.ObjectId.isValid(videoId)) {
        throw new ApiError(400, "Invalid video ID format");
    }

    try {
        const comments = await Comment.aggregate([
            {
                $match: {
                    video: new mongoose.Types.ObjectId(videoId)
                }
            },
            {
                $lookup: {
                    from: "likes",
                    let: { commentId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$comment", "$$commentId"] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "likes"
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "owner"
                }
            },
            {
                $unwind: "$owner"
            },
            {
                $project: {
                    _id: 1,
                    content: 1,
                    video: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    likes: { $size: "$likes" },
                    owner: {
                        _id: 1,
                        username: 1,
                        avatar: 1
                    }
                }
            },
            {
                $sort: { createdAt: -1 }
            }
        ]);
        
        return res
        .status(200)
        .json(new ApiResponse(200, comments, "Video comments fetched Successfully"));
    } catch (error) {
        console.error("Error in getVideoComments:", error);
        throw new ApiError(400, "Something went wrong while getting video comments");
    }
})

const addComment = asyncHandler(async (req, res) => {
    // TODO: add a comment to a video
    const {content} = req.body
    const user = req.user?._id
    const {videoId} = req.params
    
    try {
        const newComment = await Comment.create({
            content,
            owner: user,
            video: videoId
        });

        const populatedComment = await Comment.findById(newComment._id)
            .populate("owner", "username avatar");

        return res
        .status(200)
        .json(new ApiResponse(200, populatedComment, "Comment added Successfully"));
        
    } catch (error) {
        console.error("Comment creation error:", error);
        throw new ApiError(500, "Something went wrong while adding comment to video");
    }
})

const updateComment = asyncHandler(async (req, res) => {
    // TODO: update a comment
    const {content} = req.body
    const {commentId} = req.params
    const user = req.user?._id

    try {
        const comment = await Comment.findOne({
            _id: commentId,
            owner: user
        })
        if(!comment){
            throw new ApiError(404, "Comment not found or you are not allowed to update this comment");
        }
    
        comment.content = content
        await comment.save()
        return res
        .status(200)
        .json(new ApiResponse(200, comment, "Comment updated Successfully"));
    } catch (error) {
        throw new ApiError(500, "Something went wrong while updating comment");
    }

})

const deleteComment = asyncHandler(async (req, res) => {
    // TODO: delete a comment
    const {commentId} = req.params
    const user = req.user?._id

    const comment = await Comment.findOne({
        _id: commentId, 
        owner: user
    })
    
    if(!comment){
        throw new ApiError(404, "You are not allowed to delete this comment");
    }
    
    await Comment.findByIdAndDelete(commentId)
    return res
    .status(200)
    .json(new ApiResponse(200, null, "Comment deleted Successfully"));
})

const getTweetComments = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID format");
    }

    try {
        console.log("Looking for tweet:", tweetId);
        const comments = await Comment.aggregate([
            {
                $match: {
                    tweet: new mongoose.Types.ObjectId(tweetId)
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "owner"
                }
            },
            { $unwind: "$owner" },
            {
                $project: {
                    _id: 1,
                    content: 1,
                    tweet: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    owner: {
                        _id: 1,
                        username: 1,
                        avatar: 1
                    }
                }
            },
            { $sort: { createdAt: -1 } }
        ]);

        return res
            .status(200)
            .json(new ApiResponse(200, comments, "Tweet comments fetched successfully"));
    } catch (error) {
        console.error("Error in getTweetComments:", error);
        throw new ApiError(400, "Something went wrong while getting tweet comments");
    }
});

const addTweetComment = asyncHandler(async (req, res) => {
    const { content } = req.body;
    const user = req.user?._id;
    const { tweetId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID format");
    }
    console.log("Adding comment to tweet:", tweetId);
    try {
        const newComment = await Comment.create({
            content,
            owner: user,
            tweet: tweetId
        });

        const populatedComment = await Comment.findById(newComment._id)
            .populate("owner", "username avatar")

        console.log("Created comment:", newComment);

        return res
            .status(200)
            .json(new ApiResponse(200, populatedComment, "Comment added successfully"));
    } catch (error) {
        console.error("Comment creation error:", error);
        throw new ApiError(500, "Something went wrong while adding comment to tweet");
    }
});

// Update a tweet comment
const updateTweetComment = asyncHandler(async (req, res) => {
    const { content } = req.body;
    const { commentId } = req.params;
    const user = req.user?._id;

    try {
        const comment = await Comment.findOne({
            _id: commentId,
            owner: user
        });
        if (!comment) {
            throw new ApiError(404, "Comment not found or you are not allowed to update this comment");
        }

        comment.content = content;
        await comment.save();
        return res
            .status(200)
            .json(new ApiResponse(200, comment, "Comment updated successfully"));
    } catch (error) {
        throw new ApiError(500, "Something went wrong while updating comment");
    }
});


const deleteTweetComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const user = req.user?._id;

    const comment = await Comment.findOne({
        _id: commentId,
        owner: user
    });

    if (!comment) {
        throw new ApiError(404, "You are not allowed to delete this comment");
    }

    await Comment.findByIdAndDelete(commentId);
    return res
        .status(200)
        .json(new ApiResponse(200, null, "Comment deleted successfully"));
});
export {
    getVideoComments, 
    addComment, 
    updateComment,
    deleteComment,
    getTweetComments,
    addTweetComment,
    deleteTweetComment,
    updateTweetComment
    }