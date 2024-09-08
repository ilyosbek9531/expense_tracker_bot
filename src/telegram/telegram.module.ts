import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { UserService } from 'src/user/user.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RootService } from './root.service';
import { MainService } from './main.service';
import { AuthCallbackService } from './auth-callback.service';
import { GroupService } from 'src/group/group.service';
import { ExpenseService } from 'src/expense/expense.service';

@Module({
  providers: [
    TelegramService,
    AuthCallbackService,
    UserService,
    PrismaService,
    RootService,
    MainService,
    GroupService,
    ExpenseService,
  ],
})
export class TelegramModule {}
