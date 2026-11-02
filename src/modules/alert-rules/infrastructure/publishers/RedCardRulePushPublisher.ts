
import {
  createHash,
} from "node:crypto";

import type {
  RedCardDetectedPublisher,
} from "../../../radar/application/ports/RedCardDetectedPublisher";

import type {
  RedCardDetectedSignal,
} from "../../../radar/domain/entities/RedCardDetectedSignal";

import type {
  PushDeviceRepository,
} from "../../../notifications/domain/repositories/PushDeviceRepository";


import type {
  LiveMatch,
} from "../../../football/domain/entities/LiveMatch";

import type {
  MatchContext,
} from "../../../match-context/domain/entities/MatchContext";

import {
  formatRedCardPushContext,
} from "../../application/services/FormatRedCardPushContext";


import type {
  PushPreferencesRepository,
} from "../../../notifications/domain/repositories/PushPreferencesRepository";

import type {
  PushReceiptRepository,
} from "../../../notifications/domain/repositories/PushReceiptRepository";

import type {
  PushNotificationSender,
  PushSendResult,
} from "../../../notifications/application/ports/PushNotificationSender";

import type {
  AlertFacts,
  AlertRule,
  AlertRuleCondition,
  AlertRuleMetric,
} from "../../domain/AlertRule";

import {
  EvaluateAlertRule,
} from "../../application/services/EvaluateAlertRule";

import type {
  MongooseAlertRuleRepository,
} from "../repositories/MongooseAlertRuleRepository";

import {
  AlertRuleDeliveryDedup,
} from "../repositories/AlertRuleDeliveryDedup";

const RED_CARD_METRICS =
  new Set<AlertRuleMetric>([
    "totalRedCards",
    "homeRedCards",
    "awayRedCards",
    "minute",
  ]);

export class RedCardRulePushPublisher
  implements RedCardDetectedPublisher
{
  private readonly evaluator =
    new EvaluateAlertRule();

  private readonly dedup =
    new AlertRuleDeliveryDedup();

  constructor(
    private readonly rules:
      MongooseAlertRuleRepository,

    private readonly devices:
      PushDeviceRepository,

    private readonly preferences:
      PushPreferencesRepository,

    private readonly receipts:
      PushReceiptRepository,

    private readonly sender:
      PushNotificationSender,


private readonly getCachedContext?:
  (
    match: LiveMatch
  ) => MatchContext | null

	
  ) {}

  /*
   * Este método recibe eventos del
   * detector de tarjetas rojas.
   *
   * No necesita presión ofensiva.
   */
  public async publish(
    signal: RedCardDetectedSignal
  ): Promise<void> {

    if (signal.redCards.total < 1) {
      return;
    }

    const rules =
      await this.rules
        .findEnabledByPhase("live");

    for (const rule of rules) {
      try {
        await this.processRule(
          rule,
          signal
        );
      } catch (error) {
        console.error(
          "[RedCardRulePush] rule failed",
          rule.id,
          error
        );
      }
    }
  }

  private async processRule(
    rule: AlertRule,
    signal: RedCardDetectedSignal
  ): Promise<void> {

    /*
     * El alcance watchlist tendrá
     * un matcher propio.
     *
     * Hasta entonces no lo tratamos
     * como una regla global.
     */
    if (rule.scope !== "all") {
      return;
    }

    /*
     * No interpretar métricas de
     * favoritos o Team Memory como
     * si fueran datos de tarjetas.
     */
    if (!this.supportsCondition(rule.when)) {
      return;
    }

    if (!this.matchesFilters(rule, signal)) {
      return;
    }

    const facts: AlertFacts = {
      totalRedCards:
        signal.redCards.total,

      homeRedCards:
        signal.redCards.home,

      awayRedCards:
        signal.redCards.away,
    };

    const minute =
      signal.match.status.minute;

    if (
      typeof minute === "number" &&
      Number.isFinite(minute)
    ) {
      facts.minute = minute;
    }

    if (
      !this.evaluator.execute(
        rule.when,
        facts
      )
    ) {
      return;
    }

    /*
     * La preferencia principal de
     * notificaciones sigue siendo
     * obligatoria.
     */
    const preferences =
      await this.preferences
        .get(rule.ownerId);

    if (!preferences.enabled) {
      return;
    }

    /*
     * Solo los dispositivos
     * pertenecientes al dueño.
     */
    const devices =
      await this.devices
        .findActiveByOwner(rule.ownerId);

    if (devices.length === 0) {
      return;
    }

    const eventKey =
      this.buildEventKey(signal);

    const claimed =
      await this.dedup.claim(
        rule.ownerId,
        rule.id,
        eventKey
      );

    if (!claimed) {
      console.log(
        "[RedCardRulePush] duplicate",
        rule.id
      );

      return;
    }

    const match = signal.match;

    const source =
      match.sources.find(
        item =>
          item.provider === "flashscore"
      ) ??
      match.sources[0];

    const score =
      `${match.home.goals ?? "-"}-${match.away.goals ?? "-"}`;

    const affected =
      signal.affectedSide === "home"
        ? match.home.name
        : signal.affectedSide === "away"
          ? match.away.name
          : signal.affectedSide === "both"
            ? "Ambos equipos"
            : "Equipo sin confirmar";


/*
 * ==========================================
 * ENRIQUECIMIENTO DE LA NOTIFICACION
 * ==========================================
 *
 * Leer únicamente datos existentes
 * en memoria.
 *
 * Si falla, seguimos enviando
 * la notificación de roja normal.
 */

let contextExtra = "";

try {

  const cachedContext =
    this.getCachedContext
      ? this.getCachedContext(match)
      : null;



/*
 * Diagnostico temporal.
 *
 * Indica si el contexto de
 * este partido ya se encontraba
 * precargado cuando llegó la roja.
 */
if (
  process.env.ALERT_CONTEXT_DEBUG ===
  "true"
) {

  console.log(
    "[RedCardRulePush] context",
    {
      match:
        `${match.home.name} vs ${match.away.name}`,

      result:
        cachedContext
          ? "HIT"
          : "MISS",

      sources:
        match.sources.map(
          source =>
            `${source.provider}:${source.externalId}`
        ),
    }
  );
}


  contextExtra =
    formatRedCardPushContext(
      cachedContext
    );

} catch (error) {

  console.warn(
    "[RedCardRulePush] context unavailable",
    error
  );
}


const messages =
  devices.map(device => ({
    to: device.expoPushToken,

    title: "🟥 Football Radar",



body:
  `${match.home.name} ${score} ${match.away.name} · roja: ${affected}` +
  contextExtra,


    sound: "default" as const,

    channelId: "radar-alerts",

    /*
     * Categoria interactiva
     * registrada en la APK.
     */
    categoryId: "radar_red_card",

    data: {
      type: "RED_CARD_ALERT",

      focus: "red-card",

      ruleId: rule.id,

      provider:
        source?.provider ?? null,

      externalId:
        source?.externalId ?? null,

      homeName:
        match.home.name,

      awayName:
        match.away.name,

      totalRedCards:
        signal.redCards.total,

	  affectedSide: signal.affectedSide,

minute: match.status.minute ?? null,
    },
  }));


    const results =
      await this.sender.send(messages);

    const accepted =
      results.some(
        result => result.status === "ok"
      );

    if (accepted) {
      await this.dedup.confirm(
        rule.ownerId,
        rule.id,
        eventKey,
        rule.delivery.cooldownMinutes
      );
    }

    await this.processReceipts(results);

    console.log(
      "[RedCardRulePush]",
      "rule:", rule.id,
      "owner:", rule.ownerId,
      "match:",
      match.home.name,
      "vs",
      match.away.name,
      "devices:", devices.length,
      "accepted:",
      results.filter(
        item => item.status === "ok"
      ).length
    );
  }

  /*
   * Una condición compuesta debe
   * contener exclusivamente métricas
   * disponibles en este detector.
   */
  private supportsCondition(
    condition: AlertRuleCondition
  ): boolean {

    if (condition.kind === "comparison") {
      return RED_CARD_METRICS.has(
        condition.metric
      );
    }

    return (
      condition.conditions.length > 0 &&
      condition.conditions.every(
        item => this.supportsCondition(item)
      )
    );
  }

  private normalize(
    value: string
  ): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  private matchesFilters(
    rule: AlertRule,
    signal: RedCardDetectedSignal
  ): boolean {

    const country =
      this.normalize(
        signal.match.competition.country ?? ""
      );

    const competition =
      this.normalize(
        signal.match.competition.name ?? ""
      );

    const countries =
      rule.filters.countries ?? [];

    const competitions =
      rule.filters.competitions ?? [];

    const excluded =
      rule.filters.excludedCompetitions ?? [];

    if (
      countries.length > 0 &&
      !countries.some(
        value =>
          this.normalize(value) === country
      )
    ) {
      return false;
    }

    if (
      competitions.length > 0 &&
      !competitions.some(
        value =>
          this.normalize(value) === competition
      )
    ) {
      return false;
    }

    if (
      excluded.some(
        value =>
          this.normalize(value) === competition
      )
    ) {
      return false;
    }

    return true;
  }

  /*
   * Identidad estable del partido
   * y de su estado de expulsiones.
   *
   * No incluimos el minuto:
   * cambiar de 65' a 66' no debe
   * generar un aviso nuevo.
   */
  private buildEventKey(
    signal: RedCardDetectedSignal
  ): string {

    const sources =
      signal.match.sources
        .map(
          source =>
            `${source.provider}:${source.externalId}`
        )
        .sort();

    const matchKey =
      sources.find(
        value =>
          value.startsWith("flashscore:")
      ) ??
      sources[0] ??
      [
        signal.match.home.name,
        signal.match.away.name,
        signal.match.kickoffAt,
      ].join(":");

    const identity = JSON.stringify([
      "red-card",
      matchKey,
      signal.redCards.home,
      signal.redCards.away,
      signal.redCards.unknown,
      signal.redCards.total,
    ]);

    return createHash("sha256")
      .update(identity)
      .digest("hex");
  }

  private async processReceipts(
    results: PushSendResult[]
  ): Promise<void> {

    for (const result of results) {

      if (result.status === "ok") {

        if (result.receiptId) {

          const sentAt = new Date();

          await this.receipts.createPending({
            receiptId:
              result.receiptId,

            expoPushToken:
              result.token,

            sentAt,

            nextCheckAt: new Date(
              sentAt.getTime() +
              15 * 60 * 1000
            ),
          });
        }

        continue;
      }

      console.warn(
        "[RedCardRulePush] rejected",
        result.errorCode ?? "unknown",
        result.message ?? ""
      );

      if (
        result.errorCode ===
        "DeviceNotRegistered"
      ) {
        await this.devices.deactivate(
          result.token
        );
      }

      if (
        result.errorCode ===
          "MismatchSenderId" ||
        result.errorCode ===
          "InvalidCredentials"
      ) {
        console.error(
          "[RedCardRulePush] FCM error",
          result.errorCode
        );
      }
    }
  }
}

