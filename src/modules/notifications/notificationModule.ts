import {
  RegisterPushDevice,
} from "./application/use-cases/RegisterPushDevice";

import {
  ProcessPushReceipts,
} from "./application/use-cases/ProcessPushReceipts";

import {
  SendTestPush,
} from "./application/use-cases/SendTestPush";

import {
  MongoosePushDeviceRepository,
} from "./infrastructure/repositories/MongoosePushDeviceRepository";


import {
  MongoosePushReceiptRepository,
} from "./infrastructure/repositories/MongoosePushReceiptRepository";

import {
  ExpoPushNotificationSender,
} from "./infrastructure/push/ExpoPushNotificationSender";

import {
  ExpoPushReceiptClient,
} from "./infrastructure/push/ExpoPushReceiptClient";

import {
  GetPushPreferences,
} from "./application/use-cases/GetPushPreferences";

import {
  UpdatePushPreferences,
} from "./application/use-cases/UpdatePushPreferences";

import {
  MongoosePushPreferencesRepository,
} from "./infrastructure/repositories/MongoosePushPreferencesRepository";

import {
  PushReceiptScheduler,
} from "./infrastructure/schedulers/PushReceiptScheduler";

import {
  NotificationController,
} from "./presentation/controllers/NotificationController";

import {
  createNotificationRouter,
} from "./presentation/routes/notificationRoutes";


export const pushDeviceRepository =
  new MongoosePushDeviceRepository();

export const pushReceiptRepository =
  new MongoosePushReceiptRepository();

export const pushNotificationSender =
  new ExpoPushNotificationSender();

export const pushReceiptClient =
  new ExpoPushReceiptClient();


export const registerPushDevice =
  new RegisterPushDevice(
    pushDeviceRepository
  );

export const sendTestPush =
  new SendTestPush(
    pushDeviceRepository,
    pushNotificationSender
  );

export const processPushReceipts =
  new ProcessPushReceipts(
    pushReceiptRepository,
    pushDeviceRepository,
    pushReceiptClient
  );

export const pushPreferencesRepository =
  new MongoosePushPreferencesRepository();

export const getPushPreferences =
  new GetPushPreferences(
    pushPreferencesRepository
  );

export const updatePushPreferences =
  new UpdatePushPreferences(
    pushPreferencesRepository
  );

const notificationController =
  new NotificationController(
    registerPushDevice,
    sendTestPush,
    getPushPreferences,
    updatePushPreferences
  );
  

export const notificationRouter =
  createNotificationRouter(
    notificationController
  );


export function createPushReceiptScheduler() {
  const intervalMs =
    Number(
      process.env
        .PUSH_RECEIPT_SCAN_INTERVAL_MS ??
      300000
    );

  return new PushReceiptScheduler(
    processPushReceipts,
    intervalMs
  );
}


