import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('zoho_credentials')
export class ZohoCredentialEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    accessToken: string;

    @Column()
    refreshToken: string;

    @Column({ type: 'timestamp', nullable: true })
    expiresAt: Date | null;
}