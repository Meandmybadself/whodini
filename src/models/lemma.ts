import { Model, Column, Table, Unique, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Optional } from 'sequelize/types';
import Tag from './tag';

type ILemma = {
    id: number
    text: string
    tagId: number
}

type LemmaCreationAttributes = Optional<ILemma, 'id'>;

@Table({
    paranoid: true,
    timestamps: false
})
export default class Lemma extends Model<ILemma, LemmaCreationAttributes> {
    @Unique
    @Column
    text: string;

    @BelongsTo(() => Tag)
    tag: Tag;

    @ForeignKey(() => Tag)
    tagId: number;
}