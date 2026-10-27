import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

export enum MigrationStatus {
    PENDING = 'PENDING',
    IN_PROGRESS = 'IN_PROGRESS',
    SUCCESS = 'SUCCESS',
    FAILED = 'FAILED',
}

export enum MigrationDirection {
    ZOHO_TO_HUBSPOT = 'ZOHO_TO_HUBSPOT',
    HUBSPOT_TO_ZOHO = 'HUBSPOT_TO_ZOHO',
}

@Entity('migration_logs')
export class MigrationLogEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    module: string;

    @Column({
        type: 'enum',
        enum: MigrationDirection,
    })
    direction: MigrationDirection;

    @Column()
    sourceRecordId: string;

    @Column({ nullable: true })
    targetRecordId: string;

    @Column({ type: 'timestamp', nullable: true })
    sourceCreatedAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    sourceUpdatedAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    migrationStartedAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    migrationCompletedAt: Date;

    @Column({
        type: 'enum',
        enum: MigrationStatus,
        default: MigrationStatus.PENDING,
    })
    status: MigrationStatus;

    @Column({ type: 'text', nullable: true })
    errorMessage: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}