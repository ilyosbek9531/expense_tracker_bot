import { Injectable } from '@nestjs/common';
import { UpdateGroupDto } from './dto/update-group.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class GroupService {
  constructor(private prismaService: PrismaService) {}

  create(data: Prisma.GroupCreateInput) {
    return this.prismaService.group.create({ data });
  }

  findAll() {
    return this.prismaService.group.findMany({
      include: {
        UserGroup: true,
      },
    });
  }

  findOne(id: string) {
    return this.prismaService.group.findUnique({ where: { id } });
  }

  update(id: number, updateGroupDto: UpdateGroupDto) {
    return `This action updates a #${id} group`;
  }

  remove(id: number) {
    return `This action removes a #${id} group`;
  }

  findByName(name: string) {
    return this.prismaService.group.findUnique({ where: { name } });
  }

  async addUserToGroup(userId: string, groupId: string) {
    return await this.prismaService.userGroup.create({
      data: {
        userId,
        groupId,
      },
      include: {
        group: true,
      },
    });
  }

  async findOneUserGroup(userId: string, groupId: string) {
    return await this.prismaService.userGroup.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId,
        },
      },
      include: {
        group: true,
      },
    });
  }

  async approveRequest(userId: string, groupId: string) {
    await this.prismaService.userGroup.update({
      where: {
        userId_groupId: { userId, groupId },
      },
      data: { isAccepted: true },
    });
  }

  async approveUserGroupRequest(userId: string, groupId: string) {
    await this.prismaService.userGroup.update({
      where: {
        userId_groupId: {
          userId,
          groupId,
        },
      },
      data: {
        isAccepted: true,
      },
    });
  }
}
