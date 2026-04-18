import { NotificationChannel, NotificationType, PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";

const maybeDeliverEmail = async (
  userEmail: string,
  title: string,
  message: string,
): Promise<boolean> => {
  if (!env.emailWebhookUrl) {
    return false;
  }

  try {
    const response = await fetch(env.emailWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: userEmail,
        subject: title,
        text: message,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
};

export const createUserNotification = async (
  prisma: PrismaClient,
  input: {
    userId: string;
    userEmail: string;
    jobId?: string;
    type: NotificationType;
    title: string;
    message: string;
    notifyEmail?: boolean;
  },
) => {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      jobId: input.jobId,
      type: input.type,
      channel: NotificationChannel.IN_APP,
      title: input.title,
      message: input.message,
      deliveredAt: new Date(),
    },
  });

  if (!input.notifyEmail) {
    return;
  }

  const delivered = await maybeDeliverEmail(input.userEmail, input.title, input.message);
  await prisma.notification.create({
    data: {
      userId: input.userId,
      jobId: input.jobId,
      type: input.type,
      channel: NotificationChannel.EMAIL,
      title: input.title,
      message: input.message,
      deliveredAt: delivered ? new Date() : null,
    },
  });
};
