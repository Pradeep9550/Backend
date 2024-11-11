import { v2 as cloudinary} from 'cloudinary'
import fs from 'fs'                         // fs --> File System is used for file management


    // Configuration
    cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
        api_key: process.env.CLOUD_API_KEY, 
        api_secret: process.env.CLOUD_API_SECRET 
    });

    const uploadOnCloudinary = async (localFilePath) =>{
        try {
            if(!localFilePath) return null
            //upload the File on cloudinary
           const response = await cloudinary.uploader.upload(localFilePath, {
                resource_type: "auto"
            })
            // File has been uploaded successfully
            // console.log("File is uploaded on cloudinary", 
            //     response.url );
            fs.unlinkSync(localFilePath)
            return response
        } catch (error) {
            fs.unlinkSync(localFilePath)
            return null                       
        }
    }


   export { uploadOnCloudinary }
    