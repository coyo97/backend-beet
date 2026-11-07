
import mongoose from "mongoose";

import type {
  AlertRule,
  AlertRulePhase,
} from "../../domain/AlertRule";

import {
  AlertRuleModel,
  type AlertRuleDocument,
} from "../database/models/AlertRuleModel";

export type CreateAlertRuleInput =
  Omit<
    AlertRule,
    "id" | "createdAt" | "updatedAt"
  >;

export class MongooseAlertRuleRepository {

  private assertOwner(ownerId: string): void {
    if (!mongoose.isValidObjectId(ownerId)) {
      throw new Error("Invalid ownerId");
    }
  }

  private toEntity(
    doc: AlertRuleDocument
  ): AlertRule {

    return {
      id: String(doc._id),
      ownerId: String(doc.ownerId),

      name: doc.name,
      enabled: doc.enabled,

      phase: doc.phase,
      scope: doc.scope,

      filters: doc.filters,
      when: doc.when,
      delivery: doc.delivery,

      createdAt:
        doc.createdAt.toISOString(),

      updatedAt:
        doc.updatedAt.toISOString(),
    };
  }

  public async create(
    input: CreateAlertRuleInput
  ): Promise<AlertRule> {

    this.assertOwner(input.ownerId);

    const document =
      await AlertRuleModel.create({
        ...input,

        ownerId:
          new mongoose.Types.ObjectId(
            input.ownerId
          ),
      });

    return this.toEntity(document);
  }

  /*
   * Reglas visibles para un usuario.
   */
  public async findByOwner(
    ownerId: string
  ): Promise<AlertRule[]> {

    this.assertOwner(ownerId);

    const documents =
      await AlertRuleModel
        .find({ ownerId })
        .sort({ createdAt: -1 })
        .exec();

    return documents.map(
      document => this.toEntity(document)
    );
  }

  /*
   * Solamente el motor backend
   * debe utilizar esta consulta.
   *
   * Busca reglas activas de todos
   * los propietarios para evaluarlas
   * individualmente.
   */
  public async findEnabledByPhase(
    phase: AlertRulePhase
  ): Promise<AlertRule[]> {

    const documents =
      await AlertRuleModel
        .find({
          enabled: true,
          phase,
        })
        .exec();

    return documents.map(
      document => this.toEntity(document)
    );
  }

  public async setEnabled(
    ownerId: string,
    id: string,
    enabled: boolean
  ): Promise<AlertRule | null> {

    this.assertOwner(ownerId);

    if (!mongoose.isValidObjectId(id)) {
      return null;
    }

    const document =
      await AlertRuleModel
        .findOneAndUpdate(
          {
            _id: id,
            ownerId,
          },
          {
            $set: { enabled },
          },
          {
            returnDocument: "after",
            runValidators: true,
          }
        )
        .exec();

    return document
      ? this.toEntity(document)
      : null;
  }

  public async delete(
    ownerId: string,
    id: string
  ): Promise<boolean> {

    this.assertOwner(ownerId);

    if (!mongoose.isValidObjectId(id)) {
      return false;
    }

    const result =
      await AlertRuleModel
        .deleteOne({
          _id: id,
          ownerId,
        })
        .exec();

    return result.deletedCount > 0;
  }


/*
 * Reemplaza una regla existente.
 *
 * Seguridad:
 * - El propietario viene del JWT.
 * - Nunca modifica ownerId.
 * - Solo actualiza reglas del propietario.
 * - Conserva createdAt.
 */
public async replace(
  ownerId: string,
  id: string,
  input: CreateAlertRuleInput
): Promise<AlertRule | null> {

  this.assertOwner(ownerId);

  if (
    !mongoose.isValidObjectId(id) ||
    input.ownerId !== ownerId
  ) {
    return null;
  }

  const document =
    await AlertRuleModel
      .findOneAndUpdate(
        {
          _id: id,
          ownerId,
        },
        {
          $set: {
            name: input.name,
            enabled: input.enabled,
            phase: input.phase,
            scope: input.scope,
            filters: input.filters,
            when: input.when,
            delivery: input.delivery,
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
        }
      )
      .exec();

  return document
    ? this.toEntity(document)
    : null;
}

}

