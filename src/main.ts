import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  // bodyParser: false is required by @thallesp/nestjs-better-auth.
  // The package automatically reinstalls the JSON/urlencoded parsers.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Enable global DTO validation (class-validator).
  // whitelist: true strips unknown fields from the body.
  // forbidNonWhitelisted: true returns 400 when unknown fields are sent.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('ScholarTrack API')
    .setDescription('Academic management API — courses, grades, attendance')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3006);
}
bootstrap();
