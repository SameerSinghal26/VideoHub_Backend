import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary, deleteFromCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { Video } from "../models/video.model.js"
import { Playlist } from "../models/playlist.model.js"
import {createPlaylist, getUserPlaylists} from "./playlist.controller.js"

const generateAccessAndRefreshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}

const registerUser = asyncHandler( async (req, res) => {
    // get user details from frontend
    const {fullName, email, username, password, bio} = req.body
    
    // validation - not empty
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required!!!")
    }

    const existedUser = await User.findOne({
        $or :  [{ username }, { email }]
    })

    if (existedUser) {
        throw  new ApiError(409, "User already exits!!!")
    }

    let avatarLocalPath;
    if (req.files && Array.isArray(req.files.avatar) && req.files.avatar.length > 0) {
        avatarLocalPath = req.files.avatar[0].path;
    }

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }


    // upload them to cloudinary , avatar
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    // upload cover image if provided
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    

    // create user object- entry in db
    const user = await User.create({
        fullName,
        avatar: avatar?.url || "",
        coverImage: coverImage?.url || "",
        email, 
        password,
        username: username.toLowerCase(),
        bio: bio || ""
    });

    // Get the user without sensitive data
    const userWithoutSensitiveData = await User.findById(user._id)
        .select("-password -refreshToken");

    // return response
    return res.status(201).json(
        new ApiResponse(200, userWithoutSensitiveData, "User Register Successfully!")
    );
})

const loginUser = asyncHandler( async(req, res) => {
    // req body -> data
    const {email, username, password } = req.body

    // username or eamil
    if(!username && !email){
        throw new ApiError(400, "username or email should be given.")
    }

    // find the user
    const user = await User.findOne({
        $or : [{username},{email}]
    })

    if (!user) {
        throw new ApiError(404, "User does not exit!!")
    }

    // password check
    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid){
        throw new ApiError(401, "Password is incorrect!")
    }

    
    // access and refresh token
    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    // send cookie
    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // Only use secure in production
        sameSite: "lax",
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged in Successfully"
        )
    )
})

const logoutUser = asyncHandler( async (req, res) => {  
    // finding user 
    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset : {
                refreshToken : 1 // this remove the field from the document
            }
        }, 
        {
            new : true
        }
    )

    if (!user) {
        throw new ApiError(401, "User not found!!")
    }

    const options = {
        httpOnly : true,
        secure : true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out Successfully!"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request!")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
        const user = await User.findById(decodedToken?._id)

        if (!user) {
            throw new ApiError(401, "Invalid refresh token!")
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
        }

        const options = {
            httpOnly: true,
            secure: true
        }

        const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshTokens(user?._id)

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    {
                        accessToken,
                        refreshToken: newRefreshToken
                    },
                    "Access Token Refresh Successfully"
                )
            )
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            throw new ApiError(401, "Invalid refresh token")
        }
        throw new ApiError(401, error?.message || "Something went wrong while refreshing token")
    }
})

const changeCurrentPassword = asyncHandler( async (req, res) =>{
    // getting the values
    const {oldpassword, newpassword, confpassword} = req.body;

    // checking if the new and confirm password is same 
    if ( !(newpassword === confpassword) ) {
        throw new ApiError(401, "Confirm Password is not same!")
    }

    const user = await User.findById(req.user?._id);

    if (!user) {
        throw new ApiError(401, "User not found!!")
    }

    const isPasswordValid = user.isPasswordCorrect(oldpassword);

    if (!isPasswordValid) {
        throw new ApiError(401, "Old Password is not correct!!")
    }

    user.password = newpassword;
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password Change Successfully!!"))
})

const getCurrentUser = asyncHandler( async (req, res) => {
    const user = await User.findById(req.user._id).select("-password -refreshToken")
    if(!user){
        throw new ApiError(401, "User not found!!")
    }
    return res
    .status(200)
    .json(new ApiResponse(200, user, "Current User Fetched Successfully!!"))
})

const updateAccountDetails = asyncHandler( async (req, res) => {
    const {fullName, email, bio} = req.body

    if (!fullName && !email) {
        throw new ApiError(401, "All fields are required!!")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set : {
                fullName,
                email : email,
                bio: bio || ""
            }
        }, {
            new : true // it will pass the new value in user field
        }
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account Details Updated Successfully!!"))
})

const updateUserAvatar = asyncHandler( async (req, res) => {
    
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(401, "Avatar file is missing!!")
    }

    // Get the current user to find the old avatar URL
    const user = await User.findById(req.user._id)
    if (!user) {
        throw new ApiError(404, "User not found")
    }

    // Extract public ID from the old avatar URL
    const oldAvatarUrl = user.avatar
    if (oldAvatarUrl) {
        const publicId = oldAvatarUrl.split('/').pop().split('.')[0]
        await deleteFromCloudinary(publicId)
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(401, "Error while uploading the image ")
    }

    const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set : {
                avatar : avatar.url
            }
        },{
            new : true
        }
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, updatedUser, "Avatar Changed Successfully"))
})

const updateUserCoverImage = asyncHandler( async (req, res) => {
    
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(401, "Cover Image file is missing!!")
    }

    // Get the current user to find the old cover image URL
    const user = await User.findById(req.user._id)
    if (!user) {
        throw new ApiError(404, "User not found")
    }

    // Extract public ID from the old cover image URL
    const oldCoverImageUrl = user.coverImage
    if (oldCoverImageUrl) {
        // Extract public ID from Cloudinary URL
        const urlParts = oldCoverImageUrl.split('/')
        const publicId = urlParts[urlParts.length - 1].split('.')[0]
        await deleteFromCloudinary(publicId)
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(401, "Error while uploading the image ")
    }

    const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set : {
                coverImage : coverImage.url
            }
        },{
            new : true
        }
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, updatedUser, "Cover Image Changed Successfully"))
})

const getUserChannelProfile = asyncHandler( async(req,res) => {
    const { username } = req.params

    if (!username?.trim()) {
        throw new ApiError(400, "Username is missing!!")
    }

    const channel = await User.aggregate([
        {
            $match : {
                username : username?.toLowerCase()
            }
        },
        {
            $lookup : {
                from : "subscriptions",
                localField : "_id",
                foreignField : "channel",
                as : "subscribers"
            }
        },
        {
            $lookup : {
                from : "subscriptions",
                localField : "_id",
                foreignField : "subscriber",
                as : "subscribedTo"
            }
        },
        {
            $addFields : {
                subscriberCount : {
                    $size : "$subscribers"
                },
                channelSubscribedToCount : {
                    $size : "$subscribedTo"
                },
                isSubscribed : {
                    $cond : {
                        if : {
                            $in : [
                                new mongoose.Types.ObjectId(req.user?._id),
                                "$subscribers.subscriber"
                            ]
                        },
                        then : true,
                        else : false
                    }
                }
            }
        },
        {
            $project : {
                fullName : 1,
                email : 1,
                username : 1,
                subscriberCount : 1,
                channelSubscribedToCount : 1,
                isSubscribed : 1,
                avatar : 1,
                coverImage : 1,
                bio: 1
            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(400, "Channel doesn't exists!!")
    }

    return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "User channel fetched Successfully!!"))
})

const getWatchHistory = asyncHandler(async (req, res) => {
    try {
        // Validate user ID
        if (!req.user?._id) {
            throw new ApiError(400, "User ID is required");
        }

        // 1. Get the user's watchHistory array (with duplicates and order)
        const user = await User.findById(req.user._id).select("watchHistory");
        if (!user) {
            throw new ApiError(404, "User not found");
        }

        const watchHistoryIds = user.watchHistory || [];
        if (watchHistoryIds.length === 0) {
            return res.status(200).json(new ApiResponse(200, [], "No watch history."));
        }

        // 2. Fetch all videos for those IDs
        const videos = await Video.find({ _id: { $in: watchHistoryIds } })
            .populate({
                path: "owner",
                select: "fullName username avatar"
            })
            .lean();

        // 3. Map videos to the order and duplicates of watchHistoryIds
        const videoMap = {};
        videos.forEach(video => {
            videoMap[video._id.toString()] = video;
        });

        const orderedHistory = watchHistoryIds.map(id => videoMap[id.toString()]).filter(Boolean);

        return res
            .status(200)
            .json(new ApiResponse(200, orderedHistory, "User Watch History fetched Successfully!!"));
    } catch (error) {
        // Handle specific MongoDB errors
        if (error instanceof mongoose.Error.CastError) {
            throw new ApiError(400, "Invalid user ID format");
        }
        throw error;
    }
});

const clearWatchHistory = asyncHandler(async (req, res) => {
    try {
        if (!req.user?._id) {
            throw new ApiError(400, "User ID is required");
        }
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { $set: { watchHistory: [] } },
            { new: true }
        );
        if (!user) {
            throw new ApiError(404, "User not found");
        }
        return res.status(200).json(new ApiResponse(200, {}, "Watch history cleared successfully!"));
    } catch (error) {
        throw error;
    }
});

const updateUserBio = asyncHandler(async (req, res) => {
    const { bio } = req.body

    if (!bio) {
        throw new ApiError(400, "Bio is required!!")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                bio: bio
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res
        .status(200)
        .json(new ApiResponse(200, user, "User Bio updated successfully!!"))
})

const getUserById = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(400, "Invalid user ID format");
    }

    const user = await User.findById(userId)
        .select("-password -refreshToken");

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    return res.status(200).json(
        new ApiResponse(200, user, "User fetched successfully")
    );
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory,
    clearWatchHistory,
    updateUserBio,
    getUserById
 }