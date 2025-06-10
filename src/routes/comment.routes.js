import { Router } from 'express';
import {
    addComment,
    deleteComment,
    getVideoComments,
    updateComment,
    getTweetComments,
    addTweetComment,
    deleteTweetComment,
    updateTweetComment
} from "../controllers/comment.controller.js"
import {verifyJWT} from "../middlewares/auth.middleware.js"

const router = Router();

router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router.route("/:videoId").get(getVideoComments).post(addComment);
router.route("/c/:commentId").delete(deleteComment).patch(updateComment)
router.route("/tweets/:tweetId/comment").get(getTweetComments).post(addTweetComment);
router.route("/tweet-comments/:commentId").delete(deleteTweetComment).patch(updateTweetComment);

export default router