import mongoose from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {deleteFromCloudinary} from "../utils/cloudinary.js"

const createTweet = asyncHandler(async (req, res) => {
    console.log('BODY:', req.body);
    console.log('FILES:', req.files);

    // Check if req.body exists, if not initialize it
    const { content, poll } = req.body;
    const mediaFiles = req.files?.media;

    if (!content) {
        throw new ApiError(400, "Content is required for tweet");
    }

    const user = await User.findById(req.user?._id);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Create tweet object with basic fields
    const tweetData = {
        content,
        owner: user._id
    };

    // Handle media if it exists
    if (mediaFiles && mediaFiles.length > 0) {
        const mediaPromises = mediaFiles.map(async (file) => {
            const uploadedMedia = await uploadOnCloudinary(file.path);
            if (!uploadedMedia) {
                throw new ApiError(400, "Error while uploading media");
            }
            return {
                type: file.mimetype.startsWith('image/') ? 'image' : 
                      file.mimetype.startsWith('video/') ? 'video' : 'gif',
                url: uploadedMedia.url
            };
        });
        tweetData.media = await Promise.all(mediaPromises);
    }

    // Handle poll data if it exists
    if (poll) {
        try {
            const pollData = typeof poll === 'string' ? JSON.parse(poll) : poll;
            
            if (!pollData.question || !pollData.options || !Array.isArray(pollData.options)) {
                throw new ApiError(400, "Poll must have a question and an array of options");
            }

            const pollOptions = pollData.options.map(option => ({
                text: option,
                votes: []
            }));

            tweetData.poll = {
                question: pollData.question,
                options: pollOptions,
                isActive: true
            };
        } catch (error) {
            throw new ApiError(400, "Invalid poll data format: " + error.message);
        }
    }

    const tweet = await Tweet.create(tweetData);

    return res
        .status(201)
        .json(new ApiResponse(201, tweet, "Tweet created successfully"));
});

const getUserTweets = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if(!mongoose.Types.ObjectId.isValid(userId)){
        throw new ApiError(400, "Invalid user id")
    }

    const tweets = await Tweet.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails"
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "reactions.user",
                foreignField: "_id",
                as: "reactionUsers"
            }
        },
        {
            $addFields: {
                ownerDetails: { $arrayElemAt: ["$ownerDetails", 0] },
                reactionCount: { $size: "$reactions" },
                retweetCount: { $size: "$retweets" },
            }
        },
        {
            $project: {
                content: 1,
                media: 1,
                poll: 1,
                reactions: 1,
                retweets: 1,
                mentions: 1,
                hashtags: 1,
                viewCount: 1,
                createdAt: 1,
                updatedAt: 1,
                ownerDetails: {
                    _id: 1,
                    username: 1,
                    fullName: 1,
                    avatar: 1
                },
                reactionCount: 1,
                retweetCount: 1
            }
        },
        {
            $sort: { createdAt: -1 }
        }
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, tweets, "User tweets fetched successfully"));
});

const updateTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    const { content, poll } = req.body;

    if (!mongoose.Types.ObjectId.isValid(tweetId)) {
        throw new ApiError(400, "Invalid tweet id")
    }

    const tweet = await Tweet.findById(tweetId);

    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    if (tweet.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this tweet");
    }

    // Handle media uploads if new media is provided
    let mediaFiles = tweet.media;
    if (req.files && req.files.media) {
        // Delete old media files from Cloudinary
        for (const media of tweet.media) {
            const publicId = media.url.split('/').pop().split('.')[0];
            await deleteFromCloudinary(publicId);
        }

        // Upload new media files
        const mediaPromises = req.files.media.map(async (file) => {
            const uploadedMedia = await uploadOnCloudinary(file.path);
            if (!uploadedMedia) {
                throw new ApiError(400, "Error while uploading media");
            }
            return {
                type: file.mimetype.startsWith('image/') ? 'image' : 
                      file.mimetype.startsWith('video/') ? 'video' : 'gif',
                url: uploadedMedia.url
            };
        });
        mediaFiles = await Promise.all(mediaPromises);
    }

    // Transform poll options if they are simple strings
    let formattedPoll = tweet.poll;
    if (poll) {
        formattedPoll = {
            question: poll.question || content,
            options: poll.options.map(option => ({
                text: typeof option === 'string' ? option : option.text,
                votes: option.votes || []
            })),
            endTime: poll.expiresIn ? new Date(Date.now() + poll.expiresIn * 1000) : tweet.poll?.endTime,
            isActive: poll.isActive ?? tweet.poll?.isActive
        };
    }

    const updatedTweet = await Tweet.findByIdAndUpdate(
        tweetId,
        {
            $set: {
                content: content || tweet.content,
                media: mediaFiles,
                poll: formattedPoll
            }
        },
        { new: true }
    );

    return res
        .status(200)
        .json(new ApiResponse(200, updatedTweet, "Tweet updated successfully"));
});

const deleteTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(tweetId)) {
        throw new ApiError(400, "Invalid tweet id")
    }

    const tweet = await Tweet.findById(tweetId);

    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    if (tweet.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this tweet");
    }

    await Tweet.findByIdAndDelete(tweetId);

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Tweet deleted successfully"));
});

const reactToTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    const { reactionType } = req.body;

    if (!mongoose.Types.ObjectId.isValid(tweetId)) {
        throw new ApiError(400, "Invalid tweet id")
    }

    if (!['like', 'love', 'haha', 'wow', 'sad', 'angry'].includes(reactionType)) {
        throw new ApiError(400, "Invalid reaction type");
    }

    // First, find if user has already reacted
    const existingReaction = await Tweet.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(tweetId)
            }
        },
        {
            $unwind: "$reactions"
        },
        {
            $match: {
                "reactions.user": new mongoose.Types.ObjectId(req.user._id)
            }
        }
    ]);

    let updateOperation;
    if (existingReaction.length > 0) {
        // If same reaction type, remove the reaction
        if (existingReaction[0].reactions.type === reactionType) {
            updateOperation = {
                $pull: {
                    reactions: {
                        user: new mongoose.Types.ObjectId(req.user._id)
                    }
                }
            };
        } else {
            // If different reaction type, update it
            updateOperation = {
                $set: {
                    "reactions.$[elem].type": reactionType
                }
            };
        }
    } else {
        // Add new reaction
        updateOperation = {
            $push: {
                reactions: {
                    user: new mongoose.Types.ObjectId(req.user._id),
                    type: reactionType
                }
            }
        };
    }

    // Update the tweet
    await Tweet.updateOne(
        { _id: new mongoose.Types.ObjectId(tweetId) },
        updateOperation
    );

    // Get updated tweet with reactions using aggregation
    const updatedTweet = await Tweet.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(tweetId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "reactions.user",
                foreignField: "_id",
                as: "reactionUsers"
            }
        },
        {
            $addFields: {
                reactions: {
                    $map: {
                        input: "$reactions",
                        as: "reaction",
                        in: {
                            $mergeObjects: [
                                "$$reaction",
                                {
                                    user: {
                                        $arrayElemAt: [
                                            {
                                                $filter: {
                                                    input: "$reactionUsers",
                                                    as: "user",
                                                    cond: {
                                                        $eq: ["$$user._id", "$$reaction.user"]
                                                    }
                                                }
                                            },
                                            0
                                        ]
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        },
        {
            $project: {
                reactions: {
                    $map: {
                        input: "$reactions",
                        as: "reaction",
                        in: {
                            type: "$$reaction.type",
                            user: {
                                _id: "$$reaction.user._id",
                                username: "$$reaction.user.username",
                                fullName: "$$reaction.user.fullName",
                                avatar: "$$reaction.user.avatar"
                            }
                        }
                    }
                }
            }
        }
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, updatedTweet[0].reactions, "Reaction updated successfully"));
});

const voteInPoll = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    const { optionIndex } = req.body;
    console.log(optionIndex);
    

    if (!mongoose.Types.ObjectId.isValid(tweetId)) {
        throw new ApiError(400, "Invalid tweet id")
    }

    const tweet = await Tweet.findById(tweetId);

    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    if (!tweet.poll) {
        throw new ApiError(400, "This tweet doesn't have a poll");
    }

    if (!tweet.poll.isActive) {
        throw new ApiError(400, "This poll is no longer active");
    }

    if (tweet.poll.endTime && new Date() > new Date(tweet.poll.endTime)) {
        tweet.poll.isActive = false;
        await tweet.save();
        throw new ApiError(400, "This poll has ended");
    }

    if (optionIndex < 0 || optionIndex >= tweet.poll.options.length) {
        throw new ApiError(400, "Invalid option index");
    }

    // Check if user has already voted
    const hasVoted = tweet.poll.options.some(option => 
        option.votes.includes(req.user._id)
    );

    if (hasVoted) {
        throw new ApiError(400, "You have already voted in this poll");
    }

    // Add user's vote
    tweet.poll.options[optionIndex].votes.push(req.user._id);
    await tweet.save();

    // Get updated poll results
    const updatedTweet = await Tweet.findById(tweetId).select("poll");

    return res.status(200).json(new ApiResponse(200, updatedTweet, "Poll voted successfully"));
});

const getAllTweets = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, sortBy = "createdAt", sortType = "desc" } = req.query;

    const tweets = await Tweet.aggregate([
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails"
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "reactions.user",
                foreignField: "_id",
                as: "reactionUsers"
            }
        },
        {
            $addFields: {
                ownerDetails: { $arrayElemAt: ["$ownerDetails", 0] },
                reactionCount: { $size: "$reactions" },
                retweetCount: { $size: "$retweets" },
            }
        },
        {
            $project: {
                content: 1,
                media: 1,
                poll: 1,
                reactions: 1,
                retweets: 1,
                mentions: 1,
                hashtags: 1,
                viewCount: 1,
                createdAt: 1,
                updatedAt: 1,
                ownerDetails: {
                    _id: 1,
                    username: 1,
                    fullName: 1,
                    avatar: 1
                },
                reactionCount: 1,
                retweetCount: 1
            }
        },
        {
            $sort: {
                [sortBy]: sortType === "desc" ? -1 : 1
            }
        },
        {
            $skip: (parseInt(page) - 1) * parseInt(limit)
        },
        {
            $limit: parseInt(limit)
        }
    ]);

    const totalTweets = await Tweet.countDocuments();

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    tweets,
                    totalTweets,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalTweets / parseInt(limit))
                },
                "All tweets fetched successfully"
            )
        );
});


export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet,
    reactToTweet,
    voteInPoll,
    getAllTweets,
}