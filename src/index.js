// require('dotenv').config({path: './env'})
import dotenv from 'dotenv'
import mongoose from "mongoose";
import { DB_NAME } from './constants.js'
import connectDB from "./db/index.js";
import { app } from './app.js';



// Database connection approach 1 but approach 2 is best.
// import express from 'express'
// const app = express()

// ;( async () => {
//     try {
//         await mongoose.connect(`${process.env.MONGODB_URL}/${ DB_NAME }`)      //database connect
//         app.on("error", (error)=>{
//             console.log("ERROR: ", error)
//             throw error
//         })
//         app.listen(process.env.PORT, ()=>{
//             console.log(`app is listen on port ${process.env.PORT}`)
//         })
//     } catch (error) {
//         console.error("ERROR: ", error )
//     }
// })()





// Database connection approach 2


dotenv.config({
    path: './.env'
})


connectDB()
.then(()=>{
    app.on("ERROR", (error)=>{
        console.log("App not listen", error)
        throw error
    })
    app.listen(process.env.PORT || 8000, ()=>{
        console.log(`server is running at port ${process.env.PORT}`);
    })
})
.catch((error)=>{
    console.log("Mongo db connection failed !!", error)
})