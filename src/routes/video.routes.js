import express from 'express';
import {
    deleteVideo,
    getAllVideos,
    getVideoById,
    publishAVideo,
    togglePublishStatus,
    updateVideo,
    getUserVideos,
    searchVideos,
} from "../controllers/video.controller.js"
import {verifyJWT} from "../middlewares/auth.middleware.js"
import {upload} from "../middlewares/multer.middleware.js"

const router = express.Router();

router.route('/all').get(getAllVideos)

router.route('/user/:userId').get(verifyJWT, getUserVideos)

router.route("/upload-video").post(verifyJWT, upload.fields([
    {
        name: "videoFile",
        maxCount: 1,
    },
    {
        name: "thumbnail",
        maxCount: 1,
    },
    
]), publishAVideo)

router.route('/user-video/:videoId').get(verifyJWT, getVideoById)

router.route('/delete-video').delete(verifyJWT, deleteVideo)

router.route("/update-video").patch(verifyJWT, upload.single("thumbnail"), updateVideo)

router.route("/toggle/publish/:videoId").patch(verifyJWT, togglePublishStatus);

router.get('/search', searchVideos);

export default router