import { Model, Column, Table, Unique, AllowNull, BelongsTo } from 'sequelize-typescript';
import Team from './team'
import { Optional } from 'sequelize/types';

export type IUser = {
    id: number;
    slackId: string;
    teamId: number;
    introURL?: string;
    linkedInURL?: string;
    twitterURL?: string;
    githubURL?: string;
}

type UserCreationAttributes = Optional<IUser, 'id'>;

@Table({
    paranoid: true,
    timestamps: false
})
export default class User extends Model<IUser, UserCreationAttributes> {
    @Unique
    @Column
    slackId: string;

    @BelongsTo(() => Team, 'teamId')
    team: Team

    @AllowNull
    @Column
    linkedInURL?: string

    @AllowNull
    @Column
    twitterURL?: string

    @AllowNull
    @Column
    githubURL?: string
}