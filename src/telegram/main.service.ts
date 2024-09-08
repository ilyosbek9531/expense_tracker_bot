import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import { ExpenseService } from 'src/expense/expense.service';
import { GroupService } from 'src/group/group.service';
import { UserService } from 'src/user/user.service';
import { Context } from 'telegraf';
import { CallbackQuery, Message } from 'telegraf/typings/core/types/typegram';

interface UserState {
  step: number;
  expenseDetails: any;
  selectedUsers: Set<string>;
}

@Injectable()
export class MainService {
  private userStates: Map<number, UserState> = new Map();

  constructor(
    private readonly groupService: GroupService,
    private readonly userService: UserService,
    private readonly expenseService: ExpenseService,
  ) {}

  private getUserState(chatId: number): UserState {
    if (!this.userStates.has(chatId)) {
      this.userStates.set(chatId, {
        step: 0,
        expenseDetails: {},
        selectedUsers: new Set<string>(),
      });
    }
    return this.userStates.get(chatId);
  }

  private resetUserState(chatId: number) {
    this.userStates.set(chatId, {
      step: 0,
      expenseDetails: {},
      selectedUsers: new Set<string>(),
    });
  }

  async mainMenu(ctx: Context) {
    const chatId = ctx.chat.id;
    const user = await this.userService.findByChatId(chatId);

    const menu = [{ text: 'Join Group 👥' }];

    let additionalMenu = [];
    if (user.UserGroup.some((ug) => ug.isAccepted)) {
      additionalMenu = [{ text: 'Add Expense 💵' }, { text: 'History 📜' }];
    }

    let adminMenu = [];
    if (user?.role === 'ADMIN' && user.UserGroup.some((ug) => ug.isAccepted)) {
      adminMenu = [
        { text: 'Accept Requests ✅' },
        { text: 'Notify 📢' },
        { text: 'Close Expenses 🔒' },
      ];
    }

    const combinedMenu = [...additionalMenu, ...adminMenu, ...menu];

    const keyboard = [];
    for (let i = 0; i < combinedMenu.length; i += 2) {
      const row = combinedMenu.slice(i, i + 2);
      keyboard.push(row);
    }

    await ctx.reply('👋 Welcome to the main menu!', {
      reply_markup: {
        keyboard: keyboard,
        resize_keyboard: true,
        one_time_keyboard: false,
      },
    });
  }

  async showUserGroups(ctx: Context, slug: string, text: string) {
    const chatId = ctx.chat.id;

    const user = await this.userService.findByChatId(chatId);
    if (!user) {
      await ctx.reply('🚫 User not found. Please try again.');
      return;
    }

    const userGroups = await this.userService.findUserGroupsByUserId(user.id);
    const groupOptions = userGroups.map((userGroup) => [
      {
        text: userGroup.group.name,
        callback_data: `${slug}_${userGroup.group.id}`,
      },
    ]);

    await ctx.reply(`📋 Please select a group to ${text} expenses:`, {
      reply_markup: {
        inline_keyboard: groupOptions,
      },
    });
  }

  async joinGroup(ctx: Context) {
    const chatId = ctx.chat.id;
    const user = await this.userService.findByChatId(chatId);

    if (!user) {
      await ctx.reply('User not found.');
      return;
    }

    const groups = await this.groupService.findAll();
    const userGroups = await this.userService.findUserGroupsByUserId(user.id);
    const requestedGroupIds = userGroups.map((userGroup) => userGroup.groupId);
    const availableGroups = groups.filter(
      (group) => !requestedGroupIds.includes(group.id),
    );

    if (!availableGroups.length) {
      await ctx.reply('No groups available to join 🚫');
      return;
    }

    const pollOptions = availableGroups.map((group) => [
      { text: group.name, callback_data: `join_${group.id}` },
    ]);

    await ctx.reply('Please select the group to join: 👥', {
      reply_markup: {
        inline_keyboard: pollOptions,
      },
    });
  }

  async acceptRequest(ctx: Context) {
    const chatId = ctx.chat.id;
    const user = await this.userService.findByChatId(chatId);

    if (!user) {
      await ctx.reply('🚫 User not found. Please try again.');
      return;
    }

    const userGroupIds = user.UserGroup.map((ug) => ug.groupId);
    const pendingUserGroups = await this.userService.findPendingUserGroups(
      userGroupIds,
      user.id,
    );

    if (!pendingUserGroups.length) {
      await ctx.reply('🔍 No pending group requests at the moment.');
      return;
    }

    const requestOptions = pendingUserGroups.map((userGroup) => {
      return {
        text: `${userGroup.user.username} wants to join the group ${userGroup.group.name} 📩`,
        callback_data: `au_${userGroup.user.username}_${userGroup.group.name}`,
      };
    });

    await ctx.reply('⏳ Pending group requests:', {
      reply_markup: {
        inline_keyboard: requestOptions.map((option) => [option]),
      },
    });
  }

  async addExpense(ctx: Context) {
    const chatId = ctx.chat.id;
    const userState = this.getUserState(chatId);
    userState.step = 1;
    await ctx.reply(
      '💵 Please enter the amount for the expense (numeric value):',
    );
  }

  async handleMessage(ctx: Context, text: string) {
    const chatId = ctx.chat.id;
    const user = await this.userService.findByChatId(chatId);
    const userState = this.getUserState(chatId);

    if (!user) {
      await ctx.reply('🚫 User not found. Please try again.');
      return;
    }

    switch (userState.step) {
      case 1:
        const amount = parseFloat(text.replaceAll(' ', ''));
        if (isNaN(amount)) {
          await ctx.reply('⚠️ Invalid amount. Please enter a numeric value:');
          return;
        }
        userState.expenseDetails.amount = amount;
        userState.step = 2;
        await ctx.reply('📝 Please enter the description for the expense:');
        break;

      case 2:
        userState.expenseDetails.description = text;
        userState.step = 3;
        const userGroups = await this.userService.findUserGroupsByUserId(
          user.id,
        );
        const groupOptions = userGroups.map((userGroup) => [
          {
            text: userGroup.group.name,
            callback_data: `select_group_${userGroup.group.id}`,
          },
        ]);

        await ctx.reply('📋 Please select the group for this expense:', {
          reply_markup: {
            inline_keyboard: groupOptions,
          },
        });
        break;

      case 3:
        const groupId = text.split('_')[2];
        const group = await this.groupService.findOne(groupId);
        if (!group) {
          await ctx.reply('⚠️ Invalid group selected. Please try again.');
          return;
        }

        userState.expenseDetails.groupId = groupId;
        userState.step = 4;
        const groupUsers = await this.userService.findUsersByGroupId(groupId);
        const userOptions = groupUsers.map((groupUser) => [
          {
            text: `${userState.selectedUsers.has(groupUser.id) ? '✅ ' : ''}${
              groupUser.username
            }`,
            callback_data: `select_user_${groupUser.id}`,
          },
        ]);

        await ctx.reply(
          '👥 Please select users to be affected by this expense:',
          {
            reply_markup: {
              inline_keyboard: userOptions,
              one_time_keyboard: true,
            },
          },
        );

        await ctx.reply('Confirm or cancel the expense:', {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: 'Confirm ✅',
                  callback_data: 'confirm_expense',
                },
                {
                  text: 'Cancel ❌',
                  callback_data: 'cancel_expense',
                },
              ],
            ],
          },
        });
        break;

      case 4:
        const userId = text.split('_')[2];
        const selectedUser = await this.userService.findOne(userId);

        if (!selectedUser) {
          await ctx.reply('🚫 Invalid user selected. Please try again.');
          return;
        }

        if (userState.selectedUsers.has(userId)) {
          userState.selectedUsers.delete(userId);
        } else {
          userState.selectedUsers.add(userId);
        }

        const updatedGroupUsers = await this.userService.findUsersByGroupId(
          userState.expenseDetails.groupId,
        );
        const updatedUserOptions = updatedGroupUsers.map((groupUser) => [
          {
            text: `${userState.selectedUsers.has(groupUser.id) ? '✅ ' : ''}${
              groupUser.username
            }`,
            callback_data: `select_user_${groupUser.id}`,
          },
        ]);

        await ctx.editMessageReplyMarkup({
          inline_keyboard: updatedUserOptions,
        });

        break;

      default:
        break;
    }
  }

  async showHistory(ctx: Context, callbackData: string, user: any) {
    const groupId = callbackData.split('_')[2];
    const expenses = await this.expenseService.findExpensesByGroup(groupId);
    if (expenses.length === 0) {
      await ctx.reply('📊 No expenses found for this group.');
    } else {
      let totalAmount = 0;
      const debts = new Map();
      const credits = new Map();

      await ctx.reply('📊 Expenses for the group:');

      const replies = expenses.map(async (expense) => {
        totalAmount += expense.amount;

        const victimsStr = expense.victims
          .map((victim) => `${victim.username}`)
          .join(', ');

        const perVictimShare = expense.amount / expense.victims.length;

        expense.victims.forEach((victim) => {
          if (!debts.has(victim.username)) {
            debts.set(victim.username, 0);
          }
          debts.set(
            victim.username,
            debts.get(victim.username) + perVictimShare,
          );
        });

        if (!credits.has(expense.owner.username)) {
          credits.set(expense.owner.username, 0);
        }
        credits.set(
          expense.owner.username,
          credits.get(expense.owner.username) + expense.amount,
        );

        return ctx.reply(
          `Amount: ${this.formatNumber(expense.amount)} \nDescription: ${expense.description} \nOwner: ${expense.owner.username} \nVictims: [ ${victimsStr} ] \nCreated At: ${dayjs(expense.createdAt).format('D MMMM, YYYY, HH:mm')}`,
        );
      });

      await Promise.all(replies);

      let summary = `📉 Financial Summary:\n\n💰 Overall: ${this.formatNumber(totalAmount)}\n\n`;

      credits.forEach((credit, username) => {
        if (debts.has(username)) {
          const debt = debts.get(username);
          const netCredit = credit - debt;
          if (netCredit > 0) {
            credits.set(username, netCredit);
            debts.delete(username);
          } else {
            credits.delete(username);
            debts.set(username, Math.abs(netCredit));
          }
        }
      });

      const debtEntries = Array.from(debts.entries());

      debtEntries.forEach(([username, debt], index) => {
        const roundedDebt = this.formatNumber(
          this.roundToNearestThousand(debt),
        );
        summary += `${username} owes: ${debt.toFixed(2)} = ${roundedDebt}`;
        summary += index === debtEntries.length - 1 ? `\n\n` : `\n`;
      });

      credits.forEach((credit, username) => {
        summary += `${username} should receive: ${credit.toFixed(2)} = ${this.formatNumber(credit.toFixed(2))}\n`;
      });

      await ctx.reply(summary);

      if (credits.has(user.username)) {
        await ctx.replyWithAnimation({
          url: 'https://media.tenor.com/4PgHCbk6yAEAAAAM/rich-cash.gif',
        });
      } else if (debts.has(user.username)) {
        await ctx.replyWithAnimation({
          url: 'https://media.tenor.com/6CujUsC1CIkAAAAM/crying-black-guy-meme50fps-interpolated-interpolated.gif',
        });
      }
    }
  }

  async handleCallbackQuery(ctx: Context) {
    const callbackData = (ctx.callbackQuery as CallbackQuery.DataQuery).data;
    const chatId = ctx.chat.id;
    const user = await this.userService.findByChatId(chatId);

    if (!user) {
      await ctx.reply('🚫 User not found. Please try again.');
      return;
    }

    switch (true) {
      case callbackData.startsWith('select_group_'):
        await this.handleMessage(ctx, callbackData);
        break;

      case callbackData.startsWith('select_user_'):
        await this.handleMessage(ctx, callbackData);
        break;

      case callbackData.startsWith('history_group_'):
        await this.showHistory(ctx, callbackData, user);
        break;

      case callbackData.startsWith('notify_group_'):
        await this.notifyGroup(ctx, callbackData);
        break;

      case callbackData.startsWith('close_expenses_'):
        await this.closeGroupExpenses(ctx, callbackData);
        break;

      case callbackData === 'confirm_expense':
        await this.saveExpense(ctx);
        break;

      case callbackData === 'cancel_expense':
        await this.handleCancellation(ctx);
        break;

      default:
        break;
    }
  }

  roundToNearestThousand = (num: number) => {
    return Math.round(num / 1000) * 1000;
  };

  async notifyGroup(ctx: Context, callbackData: string) {
    const groupId = callbackData.split('_')[2];
    const expenses = await this.expenseService.findExpensesByGroup(groupId);

    if (expenses.length === 0) {
      await ctx.reply('📊 No expenses found for this group.');
      return;
    }

    const usersMap = new Map<string, { chatId: string; username: string }>();

    const debts = new Map<string, number>();
    const credits = new Map<string, number>();

    expenses.forEach((expense) => {
      if (!usersMap.has(expense.owner.username)) {
        usersMap.set(expense.owner.username, {
          chatId: expense.owner.chatId.toString(),
          username: expense.owner.username,
        });
      }

      expense.victims.forEach((victim) => {
        if (!usersMap.has(victim.username)) {
          usersMap.set(victim.username, {
            chatId: victim.chatId.toString(),
            username: victim.username,
          });
        }

        if (!debts.has(victim.username)) {
          debts.set(victim.username, 0);
        }

        debts.set(
          victim.username,
          debts.get(victim.username) + expense.amount / expense.victims.length,
        );
      });

      if (!credits.has(expense.owner.username)) {
        credits.set(expense.owner.username, 0);
      }

      credits.set(
        expense.owner.username,
        credits.get(expense.owner.username) + expense.amount,
      );
    });

    for (const [username, { chatId }] of usersMap) {
      const userDebts = debts.get(username) || 0;
      const userCredits = credits.get(username) || 0;

      let summary = `📊 Your Expense Summary:\n\n💰 Overall: ${userCredits - userDebts}\n\n`;

      if (userDebts > 0) {
        summary += `You owe: ${userDebts.toFixed(2)}\n`;
      }

      if (userCredits > 0) {
        summary += `You should receive: ${userCredits.toFixed(2)}\n`;
      }

      try {
        await ctx.telegram.sendMessage(chatId.toString(), summary);

        if (userCredits - userDebts > 0) {
          await ctx.telegram.sendAnimation(chatId.toString(), {
            url: 'https://media.tenor.com/4PgHCbk6yAEAAAAM/rich-cash.gif',
          });
        } else if (userCredits - userDebts < 0) {
          await ctx.telegram.sendAnimation(chatId.toString(), {
            url: 'https://media.tenor.com/6CujUsC1CIkAAAAM/crying-black-guy-meme50fps-interpolated-interpolated.gif',
          });
        }
      } catch (error) {
        console.error(
          `Failed to send message or animation to ${username}:`,
          error,
        );
      }
    }

    await ctx.reply(
      '📢 Notifications have been sent to all users in the group.',
    );
  }

  async notify(ctx: Context) {
    await this.showUserGroups(ctx, 'notify_group', 'notify');
  }

  async closeExpenses(ctx: Context) {
    await this.showUserGroups(ctx, 'close_expenses', 'close');
  }

  async closeGroupExpenses(ctx: Context, callbackData: string) {
    const groupId = callbackData.split('_')[2];
    await this.expenseService.updateExpensesStatus(groupId);
    ctx.reply('Expenses Closed ✅');

    const groupUsers = await this.userService.findUsersByGroupId(groupId);
    const chatId = ctx.chat.id;

    const admin = await this.userService.findByChatId(chatId);

    for (const user of groupUsers) {
      ctx.telegram.sendMessage(
        user.chatId.toString(),
        `${admin.username} closed expenses`,
      );
    }
  }

  async onMainText(ctx: Context) {
    const { text } = ctx.message as Message.TextMessage;
    const chatId = ctx.chat.id;
    const userState = this.getUserState(chatId);

    switch (text) {
      case 'Join Group 👥':
        await this.joinGroup(ctx);
        break;

      case 'Accept Requests ✅':
        await this.acceptRequest(ctx);
        break;

      case 'Add Expense 💵':
        await this.addExpense(ctx);
        break;

      case 'History 📜':
        await this.showUserGroups(ctx, 'history_group', 'view');
        break;

      case 'Notify 📢':
        await this.notify(ctx);
        break;

      case 'Close Expenses 🔒':
        await this.closeExpenses(ctx);
        break;

      default:
        if (userState.step > 0) {
          await this.handleMessage(ctx, text);
        }
        break;
    }
  }

  async saveExpense(ctx: Context) {
    const chatId = ctx.chat.id;
    const user = await this.userService.findByChatId(chatId);
    const userState = this.getUserState(chatId);

    if (!user) {
      await ctx.reply('🚫 User not found. Please try again.');
      return;
    }

    if (userState.step === 0) {
      ctx.reply(
        '❗ No ongoing action to cancel. Please start an action first.',
      );
      return;
    }

    if (!userState.selectedUsers.size) {
      await ctx.reply(
        '🚫 No users selected for this expense. Please choose at least one user.',
      );
      return;
    }

    const { expenseDetails, selectedUsers } = userState;
    await this.expenseService.create({
      amount: expenseDetails.amount,
      description: expenseDetails.description,
      owner: {
        connect: {
          id: user.id,
        },
      },
      group: {
        connect: {
          id: expenseDetails.groupId,
        },
      },
      victims: {
        connect: Array.from(selectedUsers).map((userId) => ({ id: userId })),
      },
    });

    await ctx.reply('Expense successfully added.');
    this.resetUserState(chatId);
  }

  async handleCancellation(ctx: Context) {
    const chatId = ctx.chat.id;
    const userState = this.getUserState(chatId);

    if (userState.step === 0) {
      ctx.reply(
        '❗ No ongoing action to cancel. Please start an action first.',
      );
      return;
    }
    await ctx.reply('❌ Expense addition has been canceled.');
    this.resetUserState(chatId);
  }

  formatNumber(number: number): string {
    return new Intl.NumberFormat('en-US').format(number).replace(/,/g, ' ');
  }
}
