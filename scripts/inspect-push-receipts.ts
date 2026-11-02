
import "dotenv/config";

import {
  connectDatabase,
  disconnectDatabase,
} from "../src/shared/infrastructure/database/mongoose";

import {
  PushReceiptModel,
} from "../src/modules/notifications/infrastructure/database/models/PushReceiptModel";

async function main(): Promise<void> {

  await connectDatabase();

  try {
    const since =
      new Date(Date.now() - 60 * 60_000);

    const receipts =
      await PushReceiptModel
        .find({
          sentAt: {
            $gte: since,
          },
        })
        .sort({
          sentAt: -1,
        })
        .limit(10)
        .select({
          _id: 0,
          status: 1,
          errorCode: 1,
          sentAt: 1,
          checkedAt: 1,
          nextCheckAt: 1,
        })
        .lean()
        .exec();

    console.log(
      "===== RECIBOS ULTIMA HORA ====="
    );

    console.table(receipts);

    console.log(
      "TOTAL:",
      receipts.length
    );

  } finally {
    await disconnectDatabase();
  }
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

