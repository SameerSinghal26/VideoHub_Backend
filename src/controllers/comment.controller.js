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
        const comments = await Comment.find({
            video: videoId
        })
        .populate("owner", "username avatar")
        .sort({createdAt: -1});
        
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

export {
    getVideoComments, 
    addComment, 
    updateComment,
    deleteComment,
    }