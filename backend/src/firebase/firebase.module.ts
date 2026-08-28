import { Global, Module } from "@nestjs/common";
import { FirebaseRealtimeService } from "./firebase-realtime.service";

@Global()
@Module({ providers: [FirebaseRealtimeService], exports: [FirebaseRealtimeService] })
export class FirebaseModule {}
