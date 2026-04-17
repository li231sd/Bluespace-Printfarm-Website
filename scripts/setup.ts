import { execSync } from "node:child_process";

const run = (command: string) => {
	console.log(`\n> ${command}`);
	execSync(command, { stdio: "inherit" });
};

run("docker compose up -d");
run("npm install");
run("npx prisma generate");
run("npx prisma migrate dev --name init");
run("npm run prisma:seed");

console.log("\nSetup complete. Run `npm run dev` to start web and API.");
