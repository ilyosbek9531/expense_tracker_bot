import { Injectable } from '@nestjs/common';
import { Hears, Help, On, Start, Update } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { CallbackQuery } from 'telegraf/typings/core/types/typegram';
import { AuthCallbackEnum } from './enums';
import { RootService } from './root.service';
import { UserService } from 'src/user/user.service';
import { MainService } from './main.service';
import { AuthCallbackService } from './auth-callback.service';
import { GroupService } from 'src/group/group.service';

@Update()
@Injectable()
export class TelegramService {
  constructor(
    private readonly authCallbackService: AuthCallbackService,
    private readonly rootService: RootService,
    private readonly userService: UserService,
    private readonly mainService: MainService,
    private readonly groupService: GroupService,
  ) {}

  @Hears('hi')
  async hearsHi(ctx: Context) {
    await ctx.reply('Hey there');
  }

  @Help()
  async helpCommand(ctx: Context) {
    await ctx.reply('Send me a sticker');
  }

  @Start()
  async onStart(ctx: Context) {
    const chatId = ctx.chat.id;
    const user = await this.userService.findByChatId(chatId);

    if (user) {
      if (user.isAccepted) {
        if (user.role === 'ROOT') {
          this.rootService.rootMenu(ctx);
        } else {
          this.mainService.mainMenu(ctx);
        }
      } else {
        await ctx.reply(
          'You already have an account and cannot register or log in again. However, it appears there are outstanding issues, such as unpaid balances or fees, that need to be resolved. Please contact @Sheraliyevilyosbek for assistance.',
        );
      }
    } else {
      this.authCallbackService.clearSessions(ctx);
      await ctx.reply(
        'Welcome to the Expense Tracker Bot! 🚀 Please register or login.',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Register ✍️', callback_data: 'register' }],
              [{ text: 'Login 🔐', callback_data: 'login' }],
            ],
          },
        },
      );
    }
  }

  @On('callback_query')
  async onCallbackQuery(ctx: Context) {
    const chatId = ctx.chat.id;
    const user = await this.userService.findByChatId(chatId);
    const callbackData = (ctx.callbackQuery as CallbackQuery.DataQuery).data;

    if (callbackData.startsWith('au')) {
      const [username, groupname] = callbackData.split('_').slice(1);
      const user = await this.userService.findByUsername(username);
      const group = await this.groupService.findByName(groupname);
      const userGroup = await this.groupService.findOneUserGroup(
        user.id,
        group.id,
      );

      if (userGroup.isAccepted) {
        ctx.reply(`User ${user.username} is already a member of ${group.name}`);
      } else {
        await this.groupService.approveUserGroupRequest(user.id, group.id);
        await ctx.reply('Request approved successfully.');
        await ctx.telegram.sendMessage(
          user.chatId.toString(),
          'Your request to join the group has been approved. Please click the /start command again to continue.',
        );
      }
    } else if (callbackData.startsWith('approve_')) {
      const userId = callbackData.split('_')[1];
      await this.rootService.approveUserRequest(ctx, userId);
    } else if (callbackData.startsWith('join_')) {
      const groupId = callbackData.split('_')[1];

      if (!user) {
        await ctx.reply('User not found 🚫');
        return;
      }

      const userGroup = await this.groupService.findOneUserGroup(
        user.id,
        groupId,
      );

      if (userGroup) {
        await ctx.reply('User is already a member of this group.');
      } else {
        const { group } = await this.groupService.addUserToGroup(
          user.id,
          groupId,
        );
        await ctx.reply(
          `You have requested to join the group ${group.name}. Please wait for approval. ⏳`,
        );
      }
    } else {
      switch (callbackData) {
        case AuthCallbackEnum.LOGIN:
          if (user) {
            await ctx.reply(
              'You already have an account and cannot register or log in again. However, it appears there are outstanding issues, such as unpaid balances or fees, that need to be resolved. Please contact @Sheraliyevilyosbek for assistance.',
            );
          } else {
            this.authCallbackService.auth(ctx, 'login');
          }
          break;

        case AuthCallbackEnum.REGISTER:
          if (user) {
            await ctx.reply(
              'You already have an account and cannot register or log in again. However, it appears there are outstanding issues, such as unpaid balances or fees, that need to be resolved. Please contact @Sheraliyevilyosbek for assistance.',
            );
          } else {
            this.authCallbackService.auth(ctx, 'register');
          }
          break;

        default:
          await this.mainService.handleCallbackQuery(ctx);
          break;
      }
    }

    await ctx.answerCbQuery();
  }

  @On('text')
  async onText(ctx: Context) {
    const chatId = ctx.chat.id;
    const session = this.authCallbackService.getSession(ctx);
    const user = await this.userService.findByChatId(chatId);

    if (!session) {
      if (user && !user?.isAccepted) {
        await ctx.reply(
          'Your account is not yet accepted. Please contact with admin @Sheraliyevilyosbek for more information.',
        );
        return;
      }
    }

    await this.authCallbackService.handleText(ctx);
    if (user && (user.role === 'ROOT' || user.username === 'ilyosbek')) {
      await this.rootService.onRootText(ctx);
    }

    if (user && (user.role !== 'ROOT' || user.username === 'ilyosbek')) {
      await this.mainService.onMainText(ctx);
    }
  }

  @On('sticker')
  async onSticker(ctx: Context) {
    await ctx.reply('👍');
  }
}
