import { Injectable } from '@nestjs/common';
import { GroupService } from 'src/group/group.service';
import { UserService } from 'src/user/user.service';
import { Context } from 'telegraf';
import { Message } from 'telegraf/typings/core/types/typegram';

interface RootSession {
  step: 'groupCreation';
}

@Injectable()
export class RootService {
  private rootState = new Map<number, RootSession>();

  constructor(
    private readonly groupService: GroupService,
    private readonly userService: UserService,
  ) {}

  async rootMenu(ctx: Context) {
    await ctx.reply('Welcome to the root menu!', {
      reply_markup: {
        keyboard: [
          [{ text: 'Create Group ✏️' }, { text: 'See Groups 📚' }],
          [{ text: 'See User Requests 📜' }],
        ],
        resize_keyboard: true,
        one_time_keyboard: false,
      },
    });
  }

  async seeGroups(ctx: Context) {
    await ctx.reply('Fetching groups... 🔍');

    const groups = await this.groupService.findAll();

    if (!groups.length) {
      await ctx.reply('No groups yet. 🚫');
      return;
    }

    for (let i = 0; i < groups.length; i++) {
      await ctx.reply(
        `Group #${i + 1} 🏷️\nName: ${groups[i].name} 📛\nMembers: ${groups[i].UserGroup.length} 🧑‍🤝‍🧑`,
      );
    }
  }

  async createGroup(ctx: Context) {
    const chatId = ctx.chat.id;
    await ctx.reply('Please provide a name for the new group: 🆕');

    this.rootState.set(chatId, {
      step: 'groupCreation',
    });
  }

  private async handleGroupCreation(ctx: Context) {
    const chatId = ctx.chat.id;
    const { text } = ctx.message as Message.TextMessage;
    const existingGroup = await this.groupService.findByName(text);

    if (existingGroup) {
      await ctx.reply('Name already exists. Please enter a different name: 📝');
    } else {
      await this.groupService.create({ name: text });
      await ctx.reply('New group is created successfully 🎉');
      this.rootState.delete(chatId);
    }
  }

  async seeUserRequests(ctx: Context) {
    const pendingUsers = await this.userService.findPendingUsers();

    if (!pendingUsers.length) {
      await ctx.reply('No pending user requests. 🚫');
      return;
    }

    const pollOptions = pendingUsers.map((user) => [
      { text: user.username, callback_data: `approve_${user.id}` },
    ]);

    await ctx.reply('Please select the users to approve: 👥', {
      reply_markup: {
        inline_keyboard: pollOptions,
      },
    });
  }

  async approveUserRequest(ctx: Context, userId: string) {
    const user = await this.userService.findOne(userId);

    if (!user.isAccepted) {
      await this.userService.approveUser(userId);
      await ctx.reply(
        `User ${user.username} has been approved successfully! ✅`,
      );
      await ctx.telegram.sendMessage(
        user.chatId.toString(),
        '🎉 Congratulations! Your request has been approved. Please click the /start command again to continue.',
      );
    } else {
      await ctx.reply(`User ${user.username} is already approved. ✅`);
    }
  }

  async onRootText(ctx: Context) {
    const chatId = ctx.chat.id;
    const session = this.rootState.get(chatId);
    const { text } = ctx.message as Message.TextMessage;

    switch (session?.step) {
      case 'groupCreation':
        const welcomeOptions = [
          'Create Group ✏️',
          'See Groups 📚',
          'See User Requests 📜',
        ];
        if (!welcomeOptions.includes(text)) {
          await this.handleGroupCreation(ctx);
        }

      default:
        switch (text) {
          case 'Create Group ✏️':
            await this.createGroup(ctx);
            break;

          case 'See Groups 📚':
            await this.seeGroups(ctx);
            break;

          case 'See User Requests 📜':
            await this.seeUserRequests(ctx);
            break;

          default:
            break;
        }
    }
  }
}
