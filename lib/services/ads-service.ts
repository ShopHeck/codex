export interface AdsService {
  getDailySpend(storeId: string, date: Date, channel?: string): Promise<number>;
}

export class ManualAdsService implements AdsService {
  async getDailySpend(storeId: string, date: Date): Promise<number> {
    const { prisma } = await import("@/lib/prisma");
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const entries = (await prisma.adSpendEntry.findMany({
      where: { storeId, date: { gte: date, lt: nextDay } }
    })) as Array<{ amount: number }>;

    return entries.reduce((sum: number, entry: { amount: number }) => sum + entry.amount, 0);
  }
}
