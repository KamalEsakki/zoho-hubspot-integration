import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('hubspot_credentials')
export class HubspotCredentialEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    accessToken: string;

    @Column()
    refreshToken: string;

    @Column()
    expiresAt: Date;
}
