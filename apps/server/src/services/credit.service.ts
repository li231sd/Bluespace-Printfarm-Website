import { prisma } from "../config/db.js";

export const adjustCredits = async (
	userId: string,
	amount: number,
	reason: string,
	jobId?: string
) => {
	return prisma.$transaction(async (tx) => {
		const updatedUser = await tx.user.update({
			where: { id: userId },
			data: { credits: { increment: amount } }
		});

		await tx.creditTransaction.create({
			data: {
				userId,
				amount,
				reason,
				jobId
			}
		});

		return updatedUser;
	});
};

export const getCreditHistory = async (userId: string) => {
	return prisma.creditTransaction.findMany({
		where: { userId },
		orderBy: { createdAt: "desc" },
		take: 50
	});
};
