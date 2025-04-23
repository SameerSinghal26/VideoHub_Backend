import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"

const generateAccessAndRefereshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}


    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}

const registerUser = asyncHandler( async (req, res) => {
    // get user details from frontend
    
     const  {fullName,  email, username, password} = req.body
     
    
    // validation - not empty

    // if(fullName === ""){ basic code
    //     throw new ApiError(400,"fullName is required")
    // }
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required!!!")
    }

    // check user already exits? : username, eamil

    const existedUser = await User.findOne({
        $or :  [{ username }, { email }]
    })

    if (existedUser) {
        throw  new ApiError(409, "User already exits!!!")
    }
    // check for images, avatar

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverimagelocalpath = req.files?.coverImages[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar is required");
    }

    // upload them to cloudinary , avatar

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    
    
    
    if (!avatar) {
        throw new ApiError(400, "Avatar file is required");
    }


    // create user object- entey in db

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email, 
        password,
        username: username.toLowerCase()
    })

    // remove the password and refresh token from response

    const createdUser = await User.findById(user._id).select("-password -refreshToken")// select method default select all the value we have to use -"field_name" to remove it from the db.

    // check the user creation

    if (!createdUser) {
        throw new ApiError(500 , "Something went wrong while registering the user!");
    }

    // return response

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Register Successfully!")
    )

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

    const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    // send cookie

    const options = {
        httpOnly : true,
        secure : true
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
    await User.findByIdAndUpdate(
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

const refreshAccessToken = asyncHandler( async (req, res) => {

    const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken

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
        httpOnly : true,
        secure : true
    }

    const { accessToken, newRefreshToken } = await generateAccessAndRefereshTokens(user._id)

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                accessToken, refreshToken : newRefreshToken
            },
            "Access Token Refresh Successfully"
        )
    )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")   
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
    
    return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current User Fetched Successfully!!"))

})

const updateAccountDetails = asyncHandler( async (req, res) => {

    const {fullName, email} = req.body

    if (!fullName || !email) {
        throw new ApiError(401, "All fields are required!!")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set : {
                fullName,
                email : email
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
    
    const  avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(401, "Avatar file is missing!!")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(401, "Error while uploading the image ")
    }

    const user = await User.findByIdAndUpdate(
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
    .json(new ApiResponse(200, user, "Avatar Changed Successfully"))
})

const updateUserCoverImage = asyncHandler( async (req, res) => {
    
    const  coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(401, "Cover Image  file is missing!!")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(401, "Error while uploading the image ")
    }

    const user = await User.findByIdAndUpdate(
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
    .json(new ApiResponse(200, user, "Cover Images Changed Successfully"))
})

const getUserChannelProfile = asyncHandler( async(req,res) => {

    const  { username } = req.params

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
                as : "subscribedTO"
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
                        if : {$in : [req.user?._id, "$subscribers.subscriber"]},
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
            }
        }
    ])
    console.log(channel);

    if (!channel?.length) {
        throw new ApiError(400, "Channel doesn't exists!!")
    }

    return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "User channel fetched Successfully!!"))
    
})

const getWatchHistory = asyncHandler( async(req, res) => {

    const user = await User.aggregate([
        {
            $match : {
                _id : new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup : {
                from : "videos",
                localField : "watchHistory",
                foreignField : "_id",
                as : "watchHistory",
                pipeline : [
                    {
                        $lookup : {
                            from : "users",
                            localField : "owner",
                            foreignField : "_id",
                            as : "owner",
                            pipeline : [
                                {
                                    $project : {
                                        fullName : 1,
                                        username : 1,
                                        avatar : 1,
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields : {
                            owner : {
                                $first : "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(new ApiResponse(200, user[0].watchHistory, "User Watch History fetched Successfully!!"))
})

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
}