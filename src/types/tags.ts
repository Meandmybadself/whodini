export interface ITags {
    createdAt: Date
    deletedAt: Date
    updatedAt: Date
    id: number
    tag: {
        id: number
        text: string
    }
    taggedId: number
    taggerId: number
    tagId: number
}