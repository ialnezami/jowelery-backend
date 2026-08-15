import { Controller, Get, Post, UseInterceptors, UploadedFile, UseGuards, Logger, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { createHmac } from 'crypto';
import axios from 'axios';
import * as FormData from 'form-data';
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
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const config = { cloud_name: cloudName, api_key: apiKey, api_secret_prefix: apiSecret?.slice(0, 4) + '***' };

    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = `folder=jowelery-test&timestamp=${timestamp}`;
    const signature = createHmac('sha1', apiSecret).update(paramsToSign).digest('hex');

    const pngBuf = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const form = new FormData();
    form.append('file', pngBuf, { filename: 'test.png', contentType: 'image/png' });
    form.append('api_key', apiKey);
    form.append('timestamp', String(timestamp));
    form.append('folder', 'jowelery-test');
    form.append('signature', signature);

    try {
      const res = await axios.post(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, form, { headers: form.getHeaders() });
      return { ok: true, config, upload_url: res.data.secure_url };
    } catch (err) {
      const rawError = err?.response?.data;
      this.logger.error(`Raw Cloudinary error: ${JSON.stringify(rawError)}`);
      return { ok: false, config, raw_error: rawError };
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
