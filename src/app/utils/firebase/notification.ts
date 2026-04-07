/* eslint-disable @typescript-eslint/no-explicit-any */

import admin from "./firebase";

export const sendPushNotifications = async (
  tokens: string | string[],
  title: string,
  body: string,
) => {
  if (!tokens) return;

  // 🔥 Normalize to array
  const tokenArray: string[] = Array.isArray(tokens) ? tokens : [tokens];

  if (tokenArray.length === 0) return;

  const message = {
    notification: { title, body },
    tokens: tokenArray,
  };
  console.log(message);
  const response = await admin.messaging().sendEachForMulticast(message);
  console.log(response);
  console.log(response.responses[0].error);
  // Auto-remove invalid or expired tokens
  response.responses.forEach((res: any, index: any) => {
    if (!res.success) {
      const errorCode = res.error?.code;

      if (
        errorCode === "messaging/registration-token-not-registered" ||
        errorCode === "messaging/invalid-registration-token"
      ) {
        console.log("Removing invalid token:", tokenArray[index]);
        // Remove token from DB here
      }
    }
  });

  return response;
};
