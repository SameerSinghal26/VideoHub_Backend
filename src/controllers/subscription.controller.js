import mongoose from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import { Video } from "../models/video.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    // TODO: toggle subscription

    if(!mongoose.Types.ObjectId.isValid(channelId)){
        throw new ApiError(400, "Invalid channel id")
    }

    if(!req.user?._id){
        throw new ApiError(400, "Invalid user id")
    }

    const subscriberId = req.user?._id

    const isSubscribed = await Subscription.findOne(
        {
            channel : channelId,
            subscriber : subscriberId
        }
    )

    let subscriptionStatus;

    try {
        if(isSubscribed){
            await Subscription.deleteOne({_id : isSubscribed._id})
            subscriptionStatus = {isSubscribed : false}
        }
        else{
            await Subscription.create({
                channel : channelId,
                subscriber : subscriberId
            })
            subscriptionStatus = {isSubscribed : true}
        }
    } catch (error) {
        throw new ApiError(400, "Error in toggling subscription")
    }
    
    return res
    .status(200).
    json(new ApiResponse(200, subscriptionStatus, "Subscription status updated Successfully"))
    

})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const {channelId} = req.params

    if(!mongoose.Types.ObjectId.isValid(channelId)){
        throw new ApiError(400, "Invalid channel id")
    }

    const userSubscribers = await Subscription.aggregate([
        {
            $match : {
                channel : new mongoose.Types.ObjectId(channelId),
            }
        },
        {
            $group : {
                _id : null,
                totalSubscribers : {
                    $sum : 1
                }
            }
        },
        {
            $project : {
                _id : 0,
                totalSubscribers : 1
            }
        }
    ])
    
    return res
    .status(200)
    .json(new ApiResponse(200, userSubscribers[0] || { subscribers : 0}, "User channel subscribers fetched Successfully"))
    
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params

    if(!mongoose.Types.ObjectId.isValid(subscriberId)){
        throw new ApiError(400, "Invalid subscriber id")
    }

    const userChannels = await Subscription.aggregate([
        {
            $match : {
                subscriber : new mongoose.Types.ObjectId(subscriberId)
            }
        },
        {
            $lookup : {
                from : "users",
                localField : "channel",
                foreignField : "_id",
                as : "subscribedTo",
                pipeline : [
                    {
                        $project : {
                            fullName : 1,
                            username : 1,
                            avatar : 1,
                            bio : 1,
                            isSubscribed : 1,
                        }
                    }
                ]
            }
        },
        {
            $addFields : {
                subscribedTo : { $first : "$subscribedTo" },
                subscriptionDate: "$createdAt"  // Preserve the subscription date
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                let: { channelId: "$channel" },
                pipeline: [
                    { $match: { $expr: { $eq: ["$channel", "$$channelId"] } } },
                    { $count: "count" }
                ],
                as: "subscriberCountArr"
            }
        },
        {
            $addFields: {
                "subscribedTo.subscriberCount": {
                    $ifNull: [{ $arrayElemAt: ["$subscriberCountArr.count", 0] }, 0]
                }
            }
        },
        {
            $replaceRoot: { 
                newRoot: {
                    $mergeObjects: ["$subscribedTo", { subscriptionDate: "$subscriptionDate" }]
                }
            }
        },
        {
            $sort : {
                "subscriptionDate" : -1
            }
        }
    ])

    return res
    .status(200)
    .json(new ApiResponse(200, userChannels, "Subscribed channels fetched Successfully"))
})

// controller to get videos from subscribed channels
const getSubscribedChannelsVideos = asyncHandler(async (req, res) => {
    const userId = req.user?._id;

    if (!userId) {
        throw new ApiError(401, "User not authenticated");
    }

    // Get all channels the user has subscribed to
    const subscriptions = await Subscription.find({ subscriber: userId });
    const channelIds = subscriptions.map(sub => sub.channel);

    // Get all videos from these channels
    const videos = await Video.find({
        owner: { $in: channelIds }
    })
    .populate({
        path: "owner",
        select: "username avatar"
    })
    .sort({ createdAt: -1 }); // Sort by newest first

    return res
        .status(200)
        .json(
            new ApiResponse(200, videos, "Subscribed channels videos fetched successfully")
        );
});

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels,
    getSubscribedChannelsVideos
}