import { Injectable } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private prismaService: PrismaService) {}

  create(createUserDto: Prisma.UserCreateInput) {
    return this.prismaService.user.create({ data: createUserDto });
  }

  findAll() {
    return `This action returns all users`;
  }

  findOne(id: string) {
    return this.prismaService.user.findUnique({ where: { id } });
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }

  findByUsername(username: string) {
    return this.prismaService.user.findUnique({ where: { username } });
  }

  findByTelegramUsername(telegramUsername: string) {
    return this.prismaService.user.findUnique({ where: { telegramUsername } });
  }

  findPendingUsers() {
    return this.prismaService.user.findMany({ where: { isAccepted: false } });
  }

  approveUser(id: string) {
    return this.prismaService.user.update({
      where: { id },
      data: { isAccepted: true },
    });
  }

  findByChatId(chatId: number) {
    return this.prismaService.user.findUnique({
      where: { chatId },
      include: { UserGroup: true },
    });
  }

  async findUserGroupsByUserId(userId: string) {
    return this.prismaService.userGroup.findMany({
      where: { userId },
      include: { group: true },
    });
  }

  async findPendingUserGroups(userGroups: string[], userId: string) {
    return await this.prismaService.userGroup.findMany({
      where: {
        userId: { not: userId },
        groupId: {
          in: userGroups,
        },
        isAccepted: false,
      },
      include: {
        group: true,
        user: true,
      },
    });
  }

  async findUsersByGroupId(groupId: string) {
    return this.prismaService.user.findMany({
      where: {
        UserGroup: {
          some: {
            groupId: groupId,
          },
        },
      },
    });
  }
}
