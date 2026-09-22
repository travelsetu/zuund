import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConnectionsModule } from '../connections/connections.module';
import { FilesModule } from '../files/files.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

@Module({
  imports: [AuthModule, ConnectionsModule, FilesModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
