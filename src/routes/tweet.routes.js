import { Router } from 'express';
import {
    createTweet,
    deleteTweet,
    getUserTweets,
    updateTweet,
    reactToTweet,
    voteInPoll,
    getAllTweets,
} from "../controllers/tweet.controller.js"
import {verifyJWT} from "../middlewares/auth.middleware.js"
import {upload} from "../middlewares/multer.middleware.js"

const router = Router();
router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router.route("/").post(
    upload.fields([
        {
            name: "media",
            maxCount: 1
        }
    ]),
    createTweet
).get(getAllTweets);
router.route("/user/:userId").get(getUserTweets);
router.route("/:tweetId")
    .patch(upload.fields([
        {
            name: "media",
            maxCount: 1
        }
    ]), updateTweet)
    .delete(deleteTweet);
router.route("/:tweetId/react").post(reactToTweet);
router.route("/:tweetId/vote").post(voteInPoll);

export default router