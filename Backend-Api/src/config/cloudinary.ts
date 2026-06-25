import { v2 as cloudinary } from "cloudinary";
import { config } from "../config"; // adjust to wherever your config object actually lives

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
});

export default cloudinary;
