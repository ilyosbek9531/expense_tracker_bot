import { Injectable } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { Context } from 'telegraf';
import { Message } from 'telegraf/typings/core/types/typegram';
import { RootService } from './root.service';
import { MainService } from './main.service';

interface UserSession {
  step: 'username' | 'password';
  username?: string;
  type: 'register' | 'login';
}

@Injectable()
export class AuthCallbackService {
  private sessions: Map<number, UserSession> = new Map();

  constructor(
    private readonly userService: UserService,
    private readonly rootService: RootService,
    private readonly mainService: MainService,
  ) {}

  async auth(ctx: Context, type: UserSession['type']) {
    const chatId = ctx.chat.id;
    this.sessions.set(chatId, { step: 'username', type });
    await ctx.reply('Please enter your username: 📝');
  }

  async handleText(ctx: Context) {
    const chatId = ctx.chat.id;
    const session = this.sessions.get(chatId);
    const { text } = ctx.message as Message.TextMessage;

    switch (session && session.step) {
      case 'username':
        const user = await this.userService.findByUsername(text);

        if (session.type === 'register' && user) {
          await ctx.reply(
            'Username already exists. Please enter a different username: 📝',
          );
          this.sessions.set(chatId, { step: 'username', type: 'register' });
          return;
        }
        session.username = text;
        session.step = 'password';
        this.sessions.set(chatId, session);
        await ctx.reply('Please enter your password: 🔐');
        break;

      case 'password':
        switch (session.type) {
          case 'login':
            const user = await this.userService.findByUsername(
              session.username,
            );
            if (user && user.password === text) {
              await ctx.reply(
                `You successfully logged in. 🎉 Your role is ${user.role}`,
              );
              if (user.isAccepted) {
                if (user.role === 'ROOT') {
                  this.rootService.rootMenu(ctx);
                } else {
                  this.mainService.mainMenu(ctx);
                }
              } else {
                await ctx.reply(
                  'Your account is not yet accepted. Please contact with admin @Sheraliyevilyosbek for more information.',
                );
              }
              this.sessions.delete(chatId);
            } else {
              await ctx.reply(
                'Invalid username or password. Please try again. ❌',
              );
              await ctx.reply('Please enter your username: 📝');
              this.sessions.set(chatId, { step: 'username', type: 'login' });
            }
            break;

          case 'register':
            await this.userService.create({
              username: session.username,
              password: text,
              chatId,
              telegramUsername: ctx.from.username,
            });
            await ctx.reply(
              '⚠️ Your account is pending approval. Please be patient while it is reviewed.\n\n' +
                '@Sheraliyevilyosbek, reach out to the admin with your username to expedite the approval process.',
            );
            this.sessions.delete(chatId);
            break;

          default:
            break;
        }

        break;
    }
  }

  clearSessions(ctx: Context) {
    const chatId = ctx.chat.id;
    this.sessions.delete(chatId);
  }

  getSession(ctx: Context): UserSession | undefined {
    const chatId = ctx.chat.id;
    return this.sessions.get(chatId);
  }
}
