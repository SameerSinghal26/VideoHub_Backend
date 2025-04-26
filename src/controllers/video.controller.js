import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"

//done...
const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy="title", sortType="asc", userId } = req.query
    //TODO: get all videos based on query, sort, pagination

    const pageNumber = parseInt(page)
    const pageLimit = parseInt(limit)
    const skip = (pageNumber - 1) * pageLimit
    const sortdirection = sortType === "asc" ? 1 : -1

    if(!isValidObjectId(userId)){
        throw new ApiError(400, "Invalid user id!")
    }

    try {
        const videos = await Video.aggregate(
            [
            {
                $match : {
                    owner : new mongoose.Types.ObjectId(userId)
                }
            },
            {
                $lookup : {
                    from : "users",
                    localField : "owner",
                    foreignField : "_id",
                    as : "owner",
                    pipeline : [
                        {
                            $project : {
                                username : 1,
                                fullName : 1,
                                avatar : 1
                            }
                        }
                    ]
                }
            },
            {
                $skip : skip,
            },
            {
                $limit : pageLimit,
            }
        ]
    )

    const totalVideos = await Video.countDocuments({owner : new mongoose.Types.ObjectId(userId)})

    const totalPages = Math.ceil(totalVideos / pageLimit)

    return res
    .status(200)
    .json(new ApiResponse(200, {videos, totalPages, totalVideos}, "Videos fetched successfully!"))
    
    } catch (error) {
        throw new ApiError(400, "Something went wrong while fetching the videos!")
    }
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body
    // TODO: get video, upload to cloudinary, create video

    if([title, description].some((field) => field?.trim() === "")){
        throw new ApiError(400, "All fields are required!")
    }

    const videolocalPath = req.files.videoFile[0].path;

    if(!videolocalPath){    
        throw new ApiError(400, "Video file is required!")
    }

    const thumbnailLocalPath = req.files.thumbnail[0].path;

    if(!thumbnailLocalPath){
        throw new ApiError(400, "Thumbnail file is required!")
    }

    // uplaoding video and thumbnail to cloudinary
    const videoFile = await uploadOnCloudinary(videolocalPath)
    const thumbnailFile = await uploadOnCloudinary(thumbnailLocalPath)

    const video = await Video.create({
        video : videoFile.url,
        thumbnail : thumbnailFile.url,
        publicId : videoFile.public_id,
        title,
        description,
        duration : videoFile.duration,
        owner : req.user?._id,

    })
    const videoUploaded = await Video.findById(video?._id).select("-video -thumbnail -views -isPublished")

    if(!videoUploaded){
        throw new ApiError(500, "Something went wrong while uploading the video!")
    }


    return res
    .status(200)
    .json(new ApiResponse(200, videoUploaded, "Video uploaded successfully!"))

})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id
    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid video id!")
    }
    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(404, "Video not found!")
    }

    const user = await User.findById(req.user?._id)

    if(!(user.watchHistory.includes(videoId))){
        await Video.findByIdAndUpdate(videoId, 
            {
                $inc: {
                    views : 1,
                }
            },
            {
                new : true,
            }
        )
    }

    await User.findByIdAndUpdate(req.user?._id, 
        {
            $addToSet : {
                watchHistory : videoId,
            }
        },
        {
            new : true,
        }
    )

    return res
    .status(200)
    .json(new ApiResponse(200, video, "Video fetched successfully!"))

    
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: update video details like title, description, thumbnail

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid video id!")
    }

    const video = await Video.findById(videoId)

    const publicId = video?.publicId

    if(publicId){
        throw new ApiError(400, "publicId is required!")
    }
    
    if(publicId){
        try {
            await cloudinary.uploader.destroy(publicId, {resource_type : "video"})
        } catch (error) {
            throw new ApiError(400, "error while deleting the video file from cloudinary to update new video file!")
        }
    }

    const videolocalPath = req.file?.path

    if(!videolocalPath){
        throw new ApiError(400, "Video file is required!")
    }

    const newVideo = await uploadOnCloudinary(videolocalPath)

    if(!newVideo){
        throw new ApiError(400, "Something went wrong while uploading the video!")
    }

    const upatedVideo = await Video.findByIdAndUpdate(videoId, 
        {
            $set : {
                video : newVideo.url,
                publicId : newVideo.public_id,
                duration : newVideo.duration,
            }
        },
        {
            new : true,
        }
    )

    return res
    .status(200)
    .json(new ApiResponse(200, upatedVideo, "Video updated successfully!"))

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid video id!")
    }

    const video = await Video.findById(videoId)

    const publicId = video?.publicId

    if(publicId){
        try {
            await cloudinary.uploader.destroy(publicId, {resource_type : "video"})
        } catch (error) {
            throw new ApiError(400, "error while deleting the video file from cloudinary!")
        }
    }
    
    return res
    .status(200)
    .json(new ApiResponse(200, [], "Video deleted successfully!"))
    
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    const video = await Video.findById(videoId)
    
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "videoId is not correct to Toggle publish status of video")
    }

    //toggle the ispublished --> if true then false if false then true
    video.isPublished = !video.isPublished

    const publishStatus = await Video.findByIdAndUpdate(videoId,
        {
            isPublished: video.isPublished
        },
        {
            new: true
        }
    ).select("-video -thumbnail -title -description -views -duration -owner")

    return res
        .status(200)
        .json(
            new ApiResponse(200, publishStatus, "If your video was published then now unpublish And if It was unpublished then now published !")
        )
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}