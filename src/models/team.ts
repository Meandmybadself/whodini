import { Column, Model, Table, Unique } from "sequelize-typescript";
import { DataTypes, Optional } from 'sequelize';
import { Installation } from '@slack/bolt'

type ITeam = {
    id: number;
    slackId: string;
    installation: Installation;
}

type TeamCreationAttributes = Optional<ITeam, 'id'>;

@Table
export default class Team extends Model<ITeam, TeamCreationAttributes> {
    @Unique
    @Column
    slackId: string

    @Column({ type: DataTypes.JSON })
    installation: Installation
}