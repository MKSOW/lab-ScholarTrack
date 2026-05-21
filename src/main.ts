import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  // bodyParser: false est requis par @thallesp/nestjs-better-auth.
  // Le package réinstalle automatiquement les parsers JSON/urlencoded.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Active la validation globale des DTOs (class-validator).
  // whitelist: true supprime les champs inconnus du body.
  // forbidNonWhitelisted: true renvoie 400 si des champs inconnus sont envoyés.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Configuration Swagger
  const config = new DocumentBuilder()
    .setTitle('ScholarTrack API')
    .setDescription('API de gestion académique — cours, notes, présences')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3006);
}
bootstrap();
