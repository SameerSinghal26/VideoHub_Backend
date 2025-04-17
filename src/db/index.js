import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async() => {
    try {
        const connectionInstance = mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log(`\n MONGODB Connected!! DB HOST : ${(await connectionInstance).connection.host}`);
        
    } catch (error) {
        console.log("MONGODB Connection Error",  error);
        process.exit(1)
    }

}

export default connectDB;