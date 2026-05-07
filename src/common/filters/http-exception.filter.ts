import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    let body: object;
    if (typeof message === 'string') {
      body = { error: message };
    } else {
      const msg = (message as any).message;
      body = { error: Array.isArray(msg) ? msg.join(', ') : (msg ?? 'An error occurred') };
    }
    response.status(status).json(body);
  }
}
