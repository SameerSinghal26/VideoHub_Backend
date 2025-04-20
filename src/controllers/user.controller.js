import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"

const registerUser = asyncHandler( async (req, res) => {
    // get user details from frontend
    
     const  {fullName,  email, username, password} = req.body
     
    
    // validation - not empty

    // if(fullName === ""){ basic code
    //     throw new ApiError(400,"fullName is required")
    // }
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required!!!")
    }

    // check user already exits? : username, eamil

    const existedUser = await User.findOne({
        $or :  [{ username }, { email }]
    })

    if (existedUser) {
        throw  new ApiError(409, "User already exits!!!")
    }
    // check for images, avatar

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverimagelocalpath = req.files?.coverImages[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar is required");
    }

    // upload them to cloudinary , avatar

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    
    
    
    if (!avatar) {
        throw new ApiError(400, "Avatar file is required");
    }


    // create user object- entey in db

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email, 
        password,
        username: username.toLowerCase()
    })

    // remove the password and refresh token from response

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken" // select method default select all the value we have to use -"field_name" to remove it from the db.
    )

    // check the user creation

    if (!createdUser) {
        throw new ApiError(500 , "Something went wrong while registering the user!");
    }

    // return response

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Register Successfully!")
    )

})

export {registerUser}