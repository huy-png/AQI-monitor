import { Module } from "@nestjs/common";
import { ClimateGateway } from "./realtime.gateway";

@Module({
  providers: [ClimateGateway],
  exports: [ClimateGateway]
})
export class RealtimeModule {}
