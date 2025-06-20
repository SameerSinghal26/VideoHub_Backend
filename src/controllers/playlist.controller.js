import mongoose from "mongoose"
import {Playlist} from "../models/playlist.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {Video} from "../models/video.model.js"
import {Like} from "../models/like.model.js"


const createPlaylist = asyncHandler(async (req, res) => {
    const {name, description} = req.body

    //TODO: create playlist

    const checkPlaylist = await Playlist.findOne({ name })
    if (checkPlaylist) {
        throw new ApiError(400, "Playlist with this name is already available")
    }

    if (!(name || description)) {
        throw new ApiError(400, "name and description is required")
    }

    if ([name, description].some((feild) => feild?.trim() === "")
    ) {
        throw new ApiError(400, "Name of Playlist and Description should not be Empty")
    }

    if (!req.user?._id) {
        throw new ApiError(401, "User Id is not available")
    }

    const playlist = await Playlist.create(
        {
            name: name,
            description: description,
            owner: req.user._id
        }
    )

    return res
        .status(200)
        .json(
            new ApiResponse(200, playlist, "Playlist Created Sucessfully")
        )
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const {userId} = req.params

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(401, "Invalid User Id")
    }

    const userPlaylist = await Playlist.find({ owner: userId })
        .populate({
            path: "owner",
            select: "_id username fullName avatar"
        })
        .populate({
            path: "videos",
            select: "_id video thumbnail title description duration views owner",
            populate: {
                path: "owner",
                select: "_id username fullname avatar"
            }
        })
        .sort({ updatedAt: -1, createdAt: -1 });

    return res
        .status(200)
        .json(
            new ApiResponse(200, userPlaylist, "User playlist is fetched sucessfully")
        )
})

const getPlaylistById = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    
    if(!playlistId){
        throw new ApiError(400, "playlistId is required")
    }

    const playlist = await Playlist.findById(playlistId)
        .populate({
            path: "videos",
            select: "thumbnail title description duration views owner updatedAt createdAt",
            populate: {
                path: "owner",
                select: "username avatar"
            }
        })
        .sort({ updatedAt: -1, createdAt: -1 });

    if(!playlist){
        throw new ApiError(404, "playlistId is not found")
    }

    // Sort the videos array by updatedAt and createdAt
    if (playlist.videos) {
        playlist.videos.sort((a, b) => {
            const dateA = new Date(a.updatedAt || a.createdAt);
            const dateB = new Date(b.updatedAt || b.createdAt);
            return dateB - dateA;
        });
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, playlist, "Playlist is fetched sucessfully")
        )
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params

    if (!(playlistId || video)) {
        throw new ApiError(400, "playlistId and videoId is required")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(404, "Video is not found")
    }

    const playlist = await Playlist.findById(playlistId)

    if (!playlist) {
        throw new ApiError(404, "playlistId is not found")
    }

    // First remove the video if it exists (to avoid duplicates)
    await Playlist.findByIdAndUpdate(playlistId,
        {
            $pull: {
                videos: videoId
            }
        }
    );

    // Then add it to the beginning of the array
    const updatedPlaylist = await Playlist.findByIdAndUpdate(playlistId,
        {
            $push: {
                videos: {
                    $each: [videoId],
                }
            },
            $set: {
                updatedAt: new Date()
            }
        },
        {
            new: true
        }
    )
    if (!updatedPlaylist) {
        throw new ApiError(404, "Error while Adding video to playlist")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, updatedPlaylist, "video added to the playlist")
        )
})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    // TODO: remove video from playlist
    if (!(playlistId || videoId)) {
        throw new ApiError(400, "playlistId and videoId is required")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(404, "Video is not found with this videoId")
    }

    const playlist = await Playlist.findById(playlistId)

    if (!playlist) {
        throw new ApiError(404, "playlistId is not found")
    }

    // If this is the 'Liked Videos' playlist, also remove the like for this video by the owner
    if (playlist.name === "Liked Videos") {
        await Like.deleteMany({
            likedBy: playlist.owner,
            video: videoId
        });
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(playlistId,
        {
            $pull: {
                videos: videoId
            }
        },
        {
            new: true
        }
    )
    if (!updatedPlaylist) {
        throw new ApiError(404, "Error while removing video to playlist")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, updatedPlaylist, "video removed sucessfully from the playlist")
        )

})

const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    // TODO: delete playlist
    if (!playlistId) {
        throw new ApiError(400, "playlistId is required")
    }

    const userPlaylist = await Playlist.findById(playlistId)

    if (userPlaylist.name === "Liked Videos") {
        // Remove all likes for this user for videos in this playlist
        await Like.deleteMany({
            likedBy: userPlaylist.owner,
            video: { $in: userPlaylist.videos }
        });
    }

    const playlistDelete = await Playlist.deleteOne({ name: userPlaylist.name, description: userPlaylist.description })

    if (!playlistDelete) {
        throw new ApiError(400, "Error while deleting playlist")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, playlistDelete, "Playlist deleted sucessfully")
        )
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body
    //TODO: update playlist

    if (!playlistId) {
        throw new ApiError(400, "playlistId is required")
    }

    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
        throw new ApiError(400, "Invalid playlist id")
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $set: {
                ...(name && { name }),
                ...(description && { description })
            }
        },
        {
            new: true
        }
    ).populate('owner');

    if (!updatedPlaylist) {
        throw new ApiError(400, "Error while updating playlist")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, updatedPlaylist, "Playlist name and description updated successfully")
        )
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist,
}