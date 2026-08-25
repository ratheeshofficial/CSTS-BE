import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateComments1787569000002 implements MigrationInterface {
  name = 'CreateComments1787569000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "comments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ticketId" uuid NOT NULL, "authorId" uuid NOT NULL, "message" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_comments" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comments_ticketId" ON "comments" ("ticketId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comments_authorId" ON "comments" ("authorId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_ticketId" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_authorId" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_authorId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_ticketId"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_comments_authorId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_comments_ticketId"`);
    await queryRunner.query(`DROP TABLE "comments"`);
  }
}
