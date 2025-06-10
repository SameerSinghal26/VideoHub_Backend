import express from "express";
import { searchAll } from "../controllers/search.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.route("/all").get(verifyJWT, searchAll);

export default router;