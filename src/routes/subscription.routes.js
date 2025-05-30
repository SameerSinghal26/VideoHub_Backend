import { Router } from 'express';
import {
    getSubscribedChannels,
    getUserChannelSubscribers,
    toggleSubscription,
} from "../controllers/subscription.controller.js"
import {verifyJWT} from "../middlewares/auth.middleware.js"

const router = Router();
router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

// Route for toggling subscription
router
    .route("/channel/:channelId")
    .post(toggleSubscription);

// Route for getting channel subscribers count
router.route("/user/:channelId").get(getUserChannelSubscribers);

// Route for getting user's subscribed channels
router.route("/subscribed/:subscriberId").get(getSubscribedChannels);

export default router