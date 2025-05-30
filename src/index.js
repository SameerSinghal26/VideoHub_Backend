// require('dotenv').config({path:'./env'})
dotenv.config({
    path: "./.env"
});

import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";


const PORT = process.env.PORT;

connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running at port: ${PORT}`);
        });
    })
    .catch((err) => {
        console.log("MongoDB connection failed!!!", err);
    });




/*
import express from "express"

const app = express()
;(async () => {  // ife
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error", (error) => {
            console.log("ERROR", error);
            throw error
        })
        app.listen(process.env.PORT, () => {
            console.log(`App is listening on port ${process.env.PORT}`);
            
        })

    } catch (error) {
        console.error("ERROR", err)
        throw err
    }
}) ()
*/