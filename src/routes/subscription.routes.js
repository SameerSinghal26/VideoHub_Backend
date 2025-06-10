import { Router } from 'express';
import {
    getSubscribedChannels,
    getUserChannelSubscribers,
    toggleSubscription,
    getSubscribedChannelsVideos
} from "../controllers/subscription.controller.js"
import {verifyJWT} from "../middlewares/auth.middleware.js"

const router = Router();
router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

// Route for getting videos from subscribed channels
router.route("/videos")
    .get(getSubscribedChannelsVideos);

// Route for getting user's subscribed channels
router.route("/subscribed/:subscriberId")
    .get(getSubscribedChannels);

// Route for channel subscription management
router.route("/channel/:channelId")
    .post(toggleSubscription)
    .get(getUserChannelSubscribers);

export default router