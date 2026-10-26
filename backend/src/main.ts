import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const frontendUrl = config.get<string>("FRONTEND_URL", "http://localhost:5173");

  app.enableShutdownHooks();
  app.setGlobalPrefix("api");
  app.enableCors({ origin: frontendUrl.split(",").map(value => value.trim()), credentials: true });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  const port = config.get<number>("PORT", 3000);
  await app.listen(port, config.get<string>("HOST", "127.0.0.1"));
}

void bootstrap();
