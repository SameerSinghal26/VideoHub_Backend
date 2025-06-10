import mongoose, {Schema} from "mongoose";

const pollOptionSchema = new Schema({
    text: {
        type: String,
        required: true
    },
    votes: [{
        type: Schema.Types.ObjectId,
        ref: "User"
    }]
});

const reactionSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    type: {
        type: String,
        enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry'],
        default: 'like'
    }
});

const tweetSchema = new Schema(
    {
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        content: {
            type: String,
            required: true,
        },
        media: [{
            type: {
                type: String,
                enum: ['image', 'video', 'gif'],
                required: false
            },
            url: {
                type: String,
                required: false
            }
        }],
        poll: {
            question: String,
            options: [pollOptionSchema],
            endTime: Date,
            isActive: {
                type: Boolean,
                default: false
            }
        },
        reactions: [reactionSchema],
        retweets: [{
            type: Schema.Types.ObjectId,
            ref: "User"
        }],
        mentions: [{
            type: Schema.Types.ObjectId,
            ref: "User"
        }],
        hashtags: [{
            type: String
        }],
        parentTweet: {
            type: Schema.Types.ObjectId,
            ref: "Tweet"
        },
        viewCount: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
);



export const Tweet = mongoose.model("Tweet", tweetSchema); 