import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTickets1787568000001 implements MigrationInterface {
  name = 'CreateTickets1787568000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."tickets_status_enum" AS ENUM('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tickets_priority_enum" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tickets_category_enum" AS ENUM('PAYMENT', 'ORDER', 'DELIVERY', 'ACCOUNT', 'TECHNICAL', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE SEQUENCE "public"."ticket_number_seq" START WITH 1001 INCREMENT BY 1`,
    );
    await queryRunner.query(
      `CREATE TABLE "tickets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ticketNumber" character varying NOT NULL, "title" character varying NOT NULL, "description" text NOT NULL, "status" "public"."tickets_status_enum" NOT NULL, "priority" "public"."tickets_priority_enum" NOT NULL, "category" "public"."tickets_category_enum" NOT NULL, "customerId" uuid NOT NULL, "assignedAgentId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "resolvedAt" TIMESTAMP, CONSTRAINT "UQ_tickets_ticketNumber" UNIQUE ("ticketNumber"), CONSTRAINT "PK_tickets" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tickets_status" ON "tickets" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tickets_priority" ON "tickets" ("priority")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tickets_category" ON "tickets" ("category")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tickets_customerId" ON "tickets" ("customerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tickets_assignedAgentId" ON "tickets" ("assignedAgentId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tickets_createdAt" ON "tickets" ("createdAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "tickets" ADD CONSTRAINT "FK_tickets_customerId" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tickets" ADD CONSTRAINT "FK_tickets_assignedAgentId" FOREIGN KEY ("assignedAgentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tickets" DROP CONSTRAINT "FK_tickets_assignedAgentId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tickets" DROP CONSTRAINT "FK_tickets_customerId"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_tickets_createdAt"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_tickets_assignedAgentId"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_tickets_customerId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_tickets_category"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_tickets_priority"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_tickets_status"`);
    await queryRunner.query(`DROP TABLE "tickets"`);
    await queryRunner.query(`DROP SEQUENCE "public"."ticket_number_seq"`);
    await queryRunner.query(`DROP TYPE "public"."tickets_category_enum"`);
    await queryRunner.query(`DROP TYPE "public"."tickets_priority_enum"`);
    await queryRunner.query(`DROP TYPE "public"."tickets_status_enum"`);
  }
}
