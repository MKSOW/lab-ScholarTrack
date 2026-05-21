import { Controller, Get } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Route de health check — accessible sans authentification
  @AllowAnonymous()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
