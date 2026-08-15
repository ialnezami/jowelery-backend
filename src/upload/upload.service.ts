import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  async uploadImage(file: Express.Multer.File): Promise<string> {
    this.logger.log(`Uploading image — cloud: ${process.env.CLOUDINARY_CLOUD_NAME}, key: ${process.env.CLOUDINARY_API_KEY?.slice(0, 6)}***, file size: ${file?.buffer?.length} bytes`);
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: 'jowelery', resource_type: 'image' }, (err, result) => {
          if (err) {
            this.logger.error(`Cloudinary error — http_code: ${err.http_code}, message: ${err.message}`);
            reject(err);
          } else {
            resolve(result!.secure_url);
          }
        })
        .end(file.buffer);
    });
  }

  async uploadVideo(file: Express.Multer.File): Promise<string> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: 'jowelery/videos', resource_type: 'video' }, (err, result) => {
          if (err) reject(err);
          else resolve(result!.secure_url);
        })
        .end(file.buffer);
    });
  }
}
