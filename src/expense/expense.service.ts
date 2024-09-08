import { Injectable } from '@nestjs/common';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ExpenseService {
  constructor(private readonly prismaService: PrismaService) {}

  create(data: Prisma.ExpenseCreateInput) {
    return this.prismaService.expense.create({ data });
  }

  findAll() {
    return `This action returns all expense`;
  }

  findOne(id: number) {
    return `This action returns a #${id} expense`;
  }

  update(id: number, updateExpenseDto: UpdateExpenseDto) {
    return `This action updates a #${id} expense`;
  }

  remove(id: number) {
    return `This action removes a #${id} expense`;
  }

  async updateExpensesStatus(groupId: string) {
    return await this.prismaService.expense.updateMany({
      where: { groupId },
      data: { isAccepted: true },
    });
  }

  async findExpensesByGroup(groupId: string) {
    return await this.prismaService.expense.findMany({
      where: { groupId, isAccepted: false },
      include: {
        owner: true,
        victims: true,
      },
    });
  }
}
