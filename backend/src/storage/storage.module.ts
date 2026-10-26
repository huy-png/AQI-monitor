import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getConnectionToken } from "@nestjs/mongoose";
import { PostgresStore } from "./postgres-store";
@Global()
@Module({
  providers: [{ provide: getConnectionToken(), inject: [ConfigService], useFactory: (config: ConfigService) => PostgresStore.open(config.getOrThrow<string>("POSTGRES_URL")) }],
  exports: [getConnectionToken()]
})
export class PostgresStorageModule {}
