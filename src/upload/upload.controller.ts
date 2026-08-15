import { Controller, Get, Post, UseInterceptors, UploadedFile, UseGuards, Logger, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('upload')
@Controller('upload')
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private upload: UploadService) {}

  @Get('test-credentials')
  async testCredentials() {
    const config = {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret_prefix: process.env.CLOUDINARY_API_SECRET?.slice(0, 4) + '***',
    };
    // Tiny 1x1 red PNG
    const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==';
    try {
      const ping = await cloudinary.api.ping();
      const upload = await cloudinary.uploader.upload(testImage, { folder: 'jowelery-test' });
      return { ok: true, config, ping, upload_url: upload.secure_url };
    } catch (err) {
      this.logger.error(`Cloudinary test failed: ${JSON.stringify(err)}`);
      return { ok: false, config, error: { http_code: err.http_code, message: err.message, full: err } };
    }
  }

  @Post('image')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    try {
      const url = await this.upload.uploadImage(file);
      return { url };
    } catch (err) {
      this.logger.error(`Upload failed — http_code: ${err?.http_code}, message: ${err?.message}`);
      throw new InternalServerErrorException(`Cloudinary ${err?.http_code ?? ''}: ${err?.message || 'Upload failed'}`);
    }
  }

  @Post('video')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 },
  }))
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    const url = await this.upload.uploadVideo(file);
    return { url };
  }
}
