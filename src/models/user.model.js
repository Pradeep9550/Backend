import mongoose, {Schema} from "mongoose";
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"

const userSchema = new Schema(
    {
        userName: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true, 
            index: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowecase: true,
            trim: true, 
        },
        fullName: {
            type: String,
            required: true,
            trim: true, 
            index: true
        },
        avatar: {
            type: String, // cloudinary url
            required: true,
        },
        coverImage: {
            type: String, // cloudinary url
        },
        watchHistory: [
            {
                type: Schema.Types.ObjectId,
                ref: "Video"
            }
        ],
        password: {
            type: String,
            required: [true, 'Password is required']
        },
        refreshToken: {
            type: String
        }

    },
    {
        timestamps: true
    }
)

userSchema.pre("save", async function (next) {
    if(!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, 10)
    next()
})


userSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password, this.password)
}

 // If using bcrypt for password hashing

// userSchema.methods.isPasswordCorrect = async function (password) {
//     return bcrypt.compare(password, this.password);
// };


// import jwt from 'jsonwebtoken'; // Ensure jwt is imported

// Method to generate an Access Token
userSchema.methods.generateAccessToken = function() {
  try {
    // Generate access token with user info
    return jwt.sign(
      {
        _id: this._id,
        email: this.email,
        userName: this.userName,
        fullName: this.fullName
      },
      process.env.ACCESS_TOKEN_SECRET,
      {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '1h' // Default to 1 hour if not defined
      }
    );
  } catch (error) {
    console.error('Error generating access token:', error);
    throw new Error('Error generating access token');
  }
};

// Method to generate a Refresh Token
userSchema.methods.generateRefreshToken = function() {
  try {
    // Generate refresh token with user ID
    return jwt.sign(
      {
        _id: this._id
      },
      process.env.REFRESH_TOKEN_SECRET,
      {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d' // Default to 7 days if not defined
      }
    );
  } catch (error) {
    console.error('Error generating refresh token:', error);
    throw new Error('Error generating refresh token');
  }
};


export const User = mongoose.model("User", userSchema)