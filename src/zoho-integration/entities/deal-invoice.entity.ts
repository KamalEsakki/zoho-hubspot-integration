
import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    Unique,
    UpdateDateColumn,
} from 'typeorm';

@Entity('deal_invoice_mappings')
@Unique(['dealId'])
export class DealInvoiceEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    dealId: string;

    @Column({ nullable: true })
    invoiceId: string;

    @Column({ nullable: true })
    invoiceNumber: string;

    @Column({ default: 'PENDING' })
    status: string;

    @Column({ type: 'text', nullable: true })
    errorMessage: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}