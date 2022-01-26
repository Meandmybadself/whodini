import { Model, Column, Table, Unique, HasMany } from 'sequelize-typescript';
import { Optional } from 'sequelize/types';
import Lemma from './lemma';

type ITag = {
    id: number;
    text: string;
}

type TagCreationAttributes = Optional<ITag, 'id'>;

@Table({
    paranoid: true,
    timestamps: false
})
export default class Tag extends Model<ITag, TagCreationAttributes> {
    @Unique
    @Column
    text: string;

    @HasMany(() => Lemma)
    lemmas: Lemma[];
}