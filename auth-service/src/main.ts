import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Transport } from '@nestjs/microservices';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice({
    transport: Transport.GRPC,
    options: {
      url: '0.0.0.0:50051',
      package: 'auth',
      protoPath: join('/proto-contracts/auth.proto'),
    },
  });

  await app.startAllMicroservices();
  await app.listen(3001);
}
bootstrap();