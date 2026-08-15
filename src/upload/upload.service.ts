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
    const cfg = cloudinary.config();
    this.logger.log(`Upload attempt — cloud: ${cfg.cloud_name}, key: ${String(cfg.api_key).slice(0, 6)}***, file size: ${file?.buffer?.length ?? 'MISSING'} bytes, mimetype: ${file?.mimetype}`);

    if (!file?.buffer?.length) {
      throw new Error('File buffer is empty or missing');
    }

    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: 'jowelery', resource_type: 'image' }, (err, result) => {
          if (err) {
            this.logger.error(`Cloudinary error — http_code: ${err.http_code}, message: ${err.message}, full: ${JSON.stringify(err)}`);
            reject(err);
          } else {
            this.logger.log(`Upload success — url: ${result!.secure_url}`);
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
