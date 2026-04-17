import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
	const adminPass = await bcrypt.hash("Admin1234", 10);
	const userPass = await bcrypt.hash("User12345", 10);

	const admin = await prisma.user.upsert({
		where: { email: "manager@hackathon.dev" },
		update: {},
		create: {
			email: "manager@hackathon.dev",
			name: "3D Print Manager",
			role: "ADMIN",
			credits: 1000,
			passwordHash: adminPass
		}
	});

	const alice = await prisma.user.upsert({
		where: { email: "alice@hackathon.dev" },
		update: {},
		create: {
			email: "alice@hackathon.dev",
			name: "Alice",
			role: "USER",
			credits: 1000,
			passwordHash: userPass
		}
	});

	await prisma.job.createMany({
		data: [
			{
				title: "Drone arm mount",
				description: "Lightweight reinforced mount",
				fileUrl: "/uploads/sample-drone-arm.stl",
				fileName: "sample-drone-arm.stl",
				filamentGrams: 85,
				creditCost: 85,
				status: "PENDING",
				userId: alice.id
			},
			{
				title: "Wheel hub adapter",
				description: "Adapter for rover prototype",
				fileUrl: "/uploads/sample-wheel-hub.obj",
				fileName: "sample-wheel-hub.obj",
				filamentGrams: 62,
				creditCost: 62,
				status: "APPROVED",
				userId: alice.id
			}
		],
		skipDuplicates: true
	});

	console.log(`Seeded users: ${admin.email}, ${alice.email}`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
