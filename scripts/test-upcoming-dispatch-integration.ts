
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  DispatchUpcomingReminders,
} from "../src/modules/notifications/application/services/DispatchUpcomingReminders";

import type {
  DueUpcomingReminder,
} from "../src/modules/notifications/application/services/GetDueUpcomingReminders";

async function main(): Promise<void> {

  const now = Date.now();

  /*
   * 10 partidos sintéticos.
   *
   * Todos están dentro de su
   * ventana de envío de 60m.
   */
  const reminders: DueUpcomingReminder[] =
    Array.from({ length: 10 }, (_, i) => ({
      matchKey: `TEST-${randomUUID()}-${i}`,
      window: "60m",
      dueAt: new Date(now - 20_000),
      kickoffAt: new Date(now + 25 * 60_000),
      dataQuality: 95,
      title: `Prueba partido ${i + 1}`,
      body: "Notificación simulada",
    } as DueUpcomingReminder));

  const ownerA = "000000000000000000000001";
  const ownerB = "000000000000000000000002";

  const tokenA1 = "ExpoPushToken[TEST-A1]";
  const tokenA2 = "ExpoPushToken[TEST-A2]";
  const tokenB1 = "ExpoPushToken[TEST-B1]";
  const tokenBlocked = "ExpoPushToken[BLOCKED]";

  /*
   * Datos simulados.
   * La cuenta A tiene dos teléfonos.
   * La cuenta B tiene uno.
   * El cuarto teléfono no autorizó avisos.
   */
  const recipients = {
    execute: async () => ({
      globalEnabled: true,
      activeDevices: 4,
      optedInDevices: 3,
      tokens: [
        tokenA1,
        tokenA2,
        tokenB1,
      ],
      ownerRecipients: [
        {
          ownerId: ownerA,
          tokens: [tokenA1, tokenA2],
        },
        {
          ownerId: ownerB,
          tokens: [tokenB1],
        },
      ],
    }),
  };

  const dueReader = {
    execute: async () => ({
      ready: reminders,
    }),
  };

  /*
   * Límite diario simulado:
   * ocho eventos únicos por propietario.
   */
  const usage =
    new Map<string, Set<string>>();

  const dailyLimit = {
    tryReserve: async (
      ownerId: string,
      matchKey: string,
      window: "24h" | "60m"
    ): Promise<boolean> => {

      const events =
        usage.get(ownerId) ??
        new Set<string>();

      const key = `${matchKey}|${window}`;

      if (events.has(key)) {
        return true;
      }

      if (events.size >= 8) {
        return false;
      }

      events.add(key);
      usage.set(ownerId, events);

      return true;
    },
  };

  /*
   * Deduplicación simulada,
   * separada por token y evento.
   */
  const claimsSet = new Set<string>();

  const claims = {
    claim: async (input: {
      matchKey: string;
      window: string;
      expoPushToken: string;
    }): Promise<boolean> => {

      const key = [
        input.matchKey,
        input.window,
        input.expoPushToken,
      ].join("|");

      if (claimsSet.has(key)) {
        return false;
      }

      claimsSet.add(key);
      return true;
    },

    complete: async (): Promise<boolean> => true,
  };

  /*
   * Emisor falso.
   *
   * NO hace peticiones HTTP.
   * NO contacta a Expo.
   */
  const sentTo: string[] = [];

  const fakeSender = {
    send: async (
      messages: Array<{ to: string }>
    ) => {

      for (const message of messages) {
        sentTo.push(message.to);
      }

      return messages.map(() => ({
        status: "ok" as const,
        receiptId: "MOCK-RECEIPT",
      }));
    },
  };

  const dispatcher =
    new DispatchUpcomingReminders(
      dueReader,
      recipients,
      claims,
      fakeSender,
      true,
      dailyLimit
    );

  /*
   * PRUEBA 1: PREVIEW
   */
  const preview =
    await dispatcher.execute({
      send: false,
    });

  assert.equal(preview.deliveryEnabled, false);
  assert.equal(preview.claimed, 0);
  assert.equal(sentTo.length, 0);
  assert.equal(usage.size, 0);

  console.log("OK: preview sin envíos ni cupos");

  /*
   * PRUEBA 2: ENTREGA SIMULADA
   *
   * Ocho eventos por cuenta.
   *
   * A: 8 x 2 teléfonos = 16 mensajes
   * B: 8 x 1 teléfono  =  8 mensajes
   *
   * Total: 24 mensajes simulados.
   */
  const firstRun =
    await dispatcher.execute({
      send: true,
    });

  assert.equal(usage.get(ownerA)?.size, 8);
  assert.equal(usage.get(ownerB)?.size, 8);

  assert.equal(firstRun.claimed, 24);
  assert.equal(sentTo.length, 24);

  assert.equal(
    sentTo.filter(t => t === tokenA1).length,
    8
  );

  assert.equal(
    sentTo.filter(t => t === tokenA2).length,
    8
  );

  assert.equal(
    sentTo.filter(t => t === tokenB1).length,
    8
  );

  assert.equal(
    sentTo.includes(tokenBlocked),
    false
  );

  console.log(
    "OK: dos cuentas, ocho eventos por cuenta"
  );

  console.log(
    "OK: dos teléfonos no duplican cupos"
  );

  console.log(
    "OK: teléfono sin consentimiento excluido"
  );

  /*
   * PRUEBA 3: REPETIR EL MISMO ESCANEO
   *
   * Los mensajes ya reservados
   * no deben volver a enviarse.
   */
  const repeated =
    await dispatcher.execute({
      send: true,
    });

  assert.equal(repeated.claimed, 0);
  assert.equal(sentTo.length, 24);

  console.log(
    "OK: segundo escaneo sin mensajes duplicados"
  );

  console.log("===== RESULTADO =====", {
    eventosCuentaA: usage.get(ownerA)?.size,
    eventosCuentaB: usage.get(ownerB)?.size,
    mensajesSimulados: sentTo.length,
    duplicadosEnSegundoEscaneo:
      repeated.duplicates,
  });

  console.log(
    "INTEGRACIÓN DEL DESPACHADOR: OK"
  );
}

void main().catch(error => {
  console.error("TEST FAILED:", error);
  process.exitCode = 1;
});

