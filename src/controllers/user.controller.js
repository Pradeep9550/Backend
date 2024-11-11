import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from '../utils/ApiError.js'
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponce } from "../utils/ApiResponce.js"
import jwt from 'jsonwebtoken'
import mongoose from "mongoose"


const generateAccessAndRefreshToken = async (userId) => {
  try {
    // Fetch the user from the database
    const user = await User.findById(userId);
    
    if (!user) {
      // User not found, throw an error
      throw new ApiError(404, "User not found");
    }

    // Generate access and refresh tokens
    const accessToken = user.generateAccessToken();  // Ensure this method is implemented in your User model
    const refreshToken = user.generateRefreshToken();  // Ensure this method is implemented in your User model

    // Optionally, save the refresh token in the user document (if your app design requires it)
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });  // Save user without validation

    // Return the tokens to the calling function
    return { accessToken, refreshToken };
  } catch (error) {
    // Log the error for debugging purposes
    console.error("Error generating tokens:", error);
    // Throw a generic error or the specific error based on the situation
    throw new ApiError(500, "Something went wrong while generating refresh and access token");
  }
};
 
const registerUser = asyncHandler ( async (req, res)=>{
  const {userName, fullName, email, password} = req.body
  console.log("Email: ", email);

  if (
      [ userName, fullName, email, password].some
      ((field) => field?.trim()==="")
  ) {
    throw new ApiError(400, "All fields are required")
  }


  const existedUser = await User.findOne({
    $or: [{ userName }, { email }]
  })

  if (existedUser) {
    throw new ApiError(409, "User with email or userName already exists")
  }
   
  // console.log(req.files)

  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLoacalPath = req.files?.coverImage[0]?.path;

  let coverImageLoacalPath;
  if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
    coverImageLoacalPath = req.files.coverImage[0].path
  }

  if(!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required")
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath)
  const coverImage = await uploadOnCloudinary(coverImageLoacalPath)

  if(!avatar) {
    throw new ApiError(400, "Avatar file is required")
  }

  const user = await User.create(                                          
    {
      fullName,                                                 // create a database
      avatar: avatar.url,
      coverImage: coverImage?.url || "",
      email,
      password,
      userName: userName.toLowerCase()
    }
  )

  const createdUser =  await User.findById(user._id).select(
    "-password -refreshToken"                                   //not select item
  )

  if(!createdUser) {
    throw new ApiError(500, "Something went wrong while registring the user")
  }

  return res.status(201).json(
    new ApiResponce(200, createdUser, "User register Successfully")
  )
})

const loginUser = asyncHandler ( async (req, res)=>{
  // req body -> Data
  // userName or email
  // find the user
  // password check
  // access and refreshToken
  // send cokie

  const {email, userName, password} = req.body

  if (!userName && !email) {
    throw new ApiError(400, "username or email is required")
}



const user = await User.findOne({
    $or: [{userName}, {email}]
})

if (!user) {
    throw new ApiError(404, "User does not exist")
}

const isPasswordValid = await user.isPasswordCorrect(password)

if (!isPasswordValid) {
throw new ApiError(401, "Invalid user credentials")
}


  const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

  const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
  

  //send cookies
  const options = {
    httpOnly: true,
    secure: true
  }

  return res
  .status(200)
  .cookie("accessToken", accessToken, options)
  .cookie("refreshToken", refreshToken, options)
  .json(
    new ApiResponce(
      200, 
      {
        user: loggedInUser, accessToken, refreshToken
      },
      "User logged in Successfully"
    )
  )
})

const logoutUser = asyncHandler (async (req, res)=>{
  await  User.findByIdAndUpdate(
    req.user._id,
   {
      $unset: {
        refreshToken: 1
      }
   },
   {
    new: true
   }
  )
  const options = {
    httpOnly: true,
    secure: true
  }

  return res
  .status(200)
  .clearCookie("accessToken", options)
  .clearCookie("refreshToken", options)
  .json(new ApiResponce(200, {}, "User logged Out"))
  

   
})

const refreshAccessToken = asyncHandler(async(req, res)=>{

  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

  if(!incomingRefreshToken) {
    throw new ApiError(401, "unauthorized request")
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    )
  
    const user = User.findById(decodedToken?._id)
  
    if(!user) {
      throw new ApiError(401, "Invalid refresh token")
    }
  
    if(incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used")
    }
  
    const {accessToken,newRefreshToken} = await generateAccessAndRefreshToken(user._id)
  
    const options = {
      httpOnly: true,
      secure: true
    }
  
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
      new ApiResponce(
        200,
        {accessToken, refreshToken: newRefreshToken},
        "Access Token refreshed"
      )
    )
  } catch (error) {
    throw new ApiError(401, error?.message) || "Invalid refresh token"
  }


 
})

const changeCurrentPassword = asyncHandler(async(req, res)=>{

  const {oldPassword , newPassword }  = req.body
  const user = await User.findById(req.user?._id)
  
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

  if(!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password")
  }

  user.password = newPassword
  await user.save({validateBeforeSave: false})

  return res
  .status(200)
  .json(new ApiResponce(200, {}, "Password changed successfully"))
})

const getCurrentUser = asyncHandler(async(req, res)=>{
  return res
  .status
  .json(200, req.user, "current user fetched successfully")
})

const updateAccountDetails = asyncHandler(async(req, res)=>{
  const {fullName, email} = req.body

  if(!fullName || !email) {
    throw new ApiError(400, "All fields are required")
  }

 const user =await User.findByIdAndUpdate(
  req.user?._id,
  {
    $set: {                                     //set receive a object
      fullName,
      email: email
    }
  },
  {new: true}                    //value return
).select("-password")

return res
.status(200)
.json(new ApiResponce(200, user, "Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async(req, res)=>{
  const avatarLocalPath = req.file?.path

  if(!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing")
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath)
  
  if(!avatar.url) {
    throw new ApiError(400, "Error while uploading on avatar")
  }

 const user =  await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url
      }
    },
    {new: true}
  ).select("-password")

  return res
  .status(200)
  .json(new ApiResponce(200, user, "Avatar updated successfully"))

})

const updateCoverImage = asyncHandler(async(req, res)=>{
  const coverImageLoacalPath = req.file?.path

  if(!coverImageLoacalPath) {
    throw new ApiError(400, "coverImage is missing")
  }
   const coverImage = await uploadOnCloudinary(coverImageLoacalPath)
    if(!coverImage.url) {
      throw new ApiError(400, "Error while uploading on coverImage")
    }

   const user =await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          coverImage: coverImage.url
        }
      },
      {
        new: true
      }
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponce(200, user, "CoverImage updated successfully"))
})

const getUserChannelProfile = asyncHandler(async(req, res)=>{
  const {userName} = req.params

  if(!userName?.trim()) {
      throw new ApiError(400, "username is missing")
  }

  const channel = await User.aggregate([
      {
        $match: {
          userName: userName?.toLowerCase()
        }
      },
      {
        $lookup: {
          from: "subscriptions",
          localField: "_id",
          foreignField: "channel",
          as: "subscribers"
        }
      },
      {
        $lookup: {
          from: "subscriptions",
          localField: "_id",
          foreignField: "subscriber",
          as: "subscribedTo"
        }
      },
      {
        $addFields: {
          subscriberCount: {
            $size: "$subscribers"
          },
          channelSubscribedToCount: {
            $size: "$subscribedTo"
          },
          isSubscribed: {
            $cond: {
              if: {$in : [req.user?._id, "$subscribers.subscriber"]},
              then: true,
              else: false
            }
          }
        }
      },
      {
        $project: {
          fullName: 1,
          userName: 1,
          subscriberCount: 1,
          channelSubscribedToCount: 1,
          isSubscribed: 1,
          avatar: 1,
          coverImage: 1
        }
      }
      ])

  if(!channel?.length) {
    throw new ApiError(404, "channel does not exists")
  }

  return res
  .status(200)
  .json(new ApiResponce(200, channel[0], "user channel fetched successfully"))
})

const getWatchHistory = asyncHandler(async(req, res)=>{

  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id)
      }
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    userName: 1,
                    avatar: 1
                  }
                }
              ]
            }
          },
          {
            $addFields: {
              owner: {
                $first: "owner"
              }
            }
          }
        ]
      }
    }
  ])

  return res
  .status(200)
  .json(
    new ApiResponce(
      200, user[0].watchHistory,
      "watch History fetched successfully"
    )
  )
})

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateCoverImage,
  getUserChannelProfile,
  getWatchHistory
}
