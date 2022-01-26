import { Model, Table, ForeignKey, Column, BelongsTo } from 'sequelize-typescript';
import { Optional } from 'sequelize/types';
import User from './user'
import Tag from './tag'
import Team from './team';

type IUserTag = {
    id: number
    tagId: number
    taggerId: number
    taggedId: number
    teamId: number
}

type UserTagCreationAttributes = Optional<IUserTag, 'id'>;

@Table({
    indexes: [
        {
            name: 'unique_tag_tagger_tagged',
            unique: true,
            fields: ['tagId', 'taggerId', 'taggedId', 'teamId']
        }
    ]
})
export default class UserTag extends Model<IUserTag, UserTagCreationAttributes> {
    @BelongsTo(() => Tag, 'tagId')
    tag: Tag;

    @BelongsTo(() => User, 'taggerId')
    tagger: User;

    @BelongsTo(() => User, 'taggedId')
    tagged: User;

    @BelongsTo(() => Team, 'teamId')
    team: Team;
}
