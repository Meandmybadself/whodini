import { getRegExMatches } from './utils/string'
import { ISlackActionResponse } from './types/slack-action';
import { ISlackCommandBody } from './types/slack-command'
import { ISlackViewSubmissionBody } from './types/slack-view-submission';
import { isValidURL } from './utils/url';
import { IUser } from './models/user'
import { PorterStemmer } from 'natural'
import { some, get } from 'lodash'
import Lemma from './models/lemma';
import slugify from 'slugify';
import Tag from './models/tag';
import Team from './models/team';
import User from './models/user';
import UserTag from './models/usertag';
import getWebClient from './slack/slack'
import { Installation } from '@slack/bolt';
import { Op } from 'sequelize';

class Whodini {
    options: {
        logger?: Console | any;
    }
    constructor(options = {}) {
        this.options = options;
        this.options.logger = this.options.logger || console;
    }

    normalizeTag(tag: string = ''): string {
        return tag.length >= 4 ? slugify(tag.toLowerCase()) : tag.toLowerCase()
    }

    async parseCommand(body: ISlackCommandBody) {
        console.log('parseCommand')
        const { text, user_id, team_id } = body
        const tokens = text.split(/\s+/g)
        const tagsToAdd = getRegExMatches(/^\+([\w|\-|_|:]+)$/m, tokens).map(this.normalizeTag)
        const tagsToRemove = getRegExMatches(/^\-([\w|\-|_|:]+)$/m, tokens).map(this.normalizeTag)
        const userSlackIdsToEffect = getRegExMatches(/^<@([^|]+)\|[^<]+>$/m, tokens);
        const bareCommandsOrTags = getRegExMatches(/^([^\+|^\-]\w+)$/m, tokens);

        // Convert slack ids to db ids.
        const team: Installation = await this.getTeamBySlackId(team_id)
        const teamId: number = await this.getTeamIdBySlackId(team_id)
        const bot_token: string = team.bot.token
        const requestingUserDBId = await this.getUserIdBySlackId(user_id, teamId)
        const usersToEffect = await this.getUserIdsBySlackIds(userSlackIdsToEffect, teamId);

        console.log(tagsToAdd);
        console.log(tagsToRemove);
        console.log(usersToEffect);
        console.log(bareCommandsOrTags);

        if (some(tagsToAdd) && some(usersToEffect)) {
            await Promise.all(tagsToAdd.map(async tagText => this.addTagToUsers(teamId, requestingUserDBId, usersToEffect, tagText)))
        }

        if (some(tagsToRemove) && some(usersToEffect)) {
            await Promise.all(tagsToRemove.map(async tagText => this.removeTagFromUsers(teamId, requestingUserDBId, usersToEffect, tagText)))
        }

        if ((some(tagsToAdd) || some(tagsToRemove)) && some(usersToEffect)) {
            return this.getUserProfileResponse(usersToEffect[0], requestingUserDBId)
        }

        if (!some(tagsToAdd) && !some(tagsToRemove) && !some(bareCommandsOrTags) && !some(usersToEffect)) {
            return this.getUserProfileResponse(requestingUserDBId, requestingUserDBId)
        }

        if (some(bareCommandsOrTags)) {
            switch (bareCommandsOrTags[0]) {
                case 'tags':
                    // Returns all tags.
                    const userTags = (await UserTag.findAll({ where: { teamId }, include: [{ model: Tag, as: 'tag' }] })).map(userTag => userTag.get({ plain: true }))
                    // Reduce into [ tag - count ]
                    const userTagAggObj = userTags.reduce((currentTags, newTag) => {
                        const tagText: string = get(newTag, 'tag.text')
                        if (!currentTags[tagText]) {
                            currentTags[tagText] = 0
                        }
                        currentTags[tagText]++
                        return currentTags
                    }, {})

                    let userTagAggArr: { text: string, count: number }[] = Object.keys(userTagAggObj).map(text => ({ text, count: userTagAggObj[text] })).sort((a, b) => b.count - a.count)
                    console.log('userTagAggArr', userTagAggArr)

                    const response: any = {
                        "blocks": [
                            {
                                "type": "section",
                                "text": {
                                    "type": "mrkdwn",
                                    "text": "*All Used Tags*"
                                }
                            },
                            {
                                "type": "divider"
                            }
                        ]
                    }

                    while (userTagAggArr.length) {
                        const batch = userTagAggArr.splice(0, 5)
                        response.blocks.push(
                            {
                                "type": "actions",
                                "elements": batch.map(tag => ({
                                    "type": "button",
                                    "text": {
                                        "type": "plain_text",
                                        "text": `${tag.text} • ${tag.count}`,
                                    },
                                    "action_id": JSON.stringify(['view-tag', tag.text]),
                                }))
                            }
                        )
                    }

                    return response


                case 'me':
                    const user_db_id = await this.getUserIdBySlackId(user_id, teamId)
                    return this.getUserProfileResponse(user_db_id, requestingUserDBId)
                case 'help':
                case '':
                    const hook = '/profile'
                    return {
                        response_type: 'ephemeral',
                        text: `Learn more about your team members.
*Available commands*\n
\*${hook} @user\*\nGet a user's profile.\n
\*${hook} me\*\nGet your profile.\n
\*${hook} +tag @user\*\nAdd *tag* to *@user*.\n
\*${hook} -tag @user\*\nRemove *tag* from *@user*.\n
\*${hook} tags\*\nGet a list of all tags used by the team.\n
\*${hook} help\*\nThis help message.`
                    }
                default:
                    return this.getTagSearchResponse(bareCommandsOrTags[0], teamId, bot_token)

            }
        }
        if (!some(tagsToAdd) && !some(tagsToRemove) && !some(bareCommandsOrTags) && usersToEffect.length === 1) {
            return this.getUserProfileResponse(usersToEffect[0], requestingUserDBId)
        }
    }



    async getTagSearchResponse(tagText: string, teamId: number, bot_token: string) {
        const response: { blocks: any } = {
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `Users tagged with *${tagText}*`
                    }
                },
                {
                    "type": "divider"
                }
            ]
        }

        // const stem = this.stem(this.normalizeTag(tag))

        // const lemma = await Lemma.findOne({ where: { text: stem } })

        const noTagsSection = {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": `No users tagged with *${tagText}*`
            }
        }

        tagText = this.normalizeTag(tagText)
        const tag = await Tag.findOne({ where: { text: tagText } })


        if (tag) {
            console.log('found tag')
            // See if we have users in this team with this tag.
            const userTags = await UserTag.findAll({ where: { tagId: tag.get('id'), teamId }, include: [{ model: User, as: 'tagged' }, { model: Tag, as: 'tag' }] })

            console.log('userTags', userTags)

            if (userTags.length) {
                // Collapse into counted list.
                const userTagsCounted = userTags.reduce((currentTags, newTag) => {
                    console.log(newTag)
                    const taggedUser = newTag.get('tagged')
                    const taggedUserSlackId = taggedUser.get('slackId')
                    const taggedUserDBId = newTag.get('tagged').get('id')
                    if (!currentTags[taggedUserSlackId]) {
                        currentTags[taggedUserSlackId] = { slackId: taggedUserSlackId, dbId: taggedUserDBId, count: 0 }
                    }
                    currentTags[taggedUserSlackId].count++
                    return currentTags
                }, {})

                const userTagsSortedArr = Object.keys(userTagsCounted).map(slackId => ({ slackId, dbId: userTagsCounted[slackId].dbId, count: userTagsCounted[slackId].count })).sort((a, b) => a.count - b.count)
                let userTagsWithNames = await Promise.all(userTagsSortedArr.map(async ({ slackId, dbId, count }) => {
                    const userSearchResult = await getWebClient(bot_token).users.info({ user: slackId })
                    const userName = get(userSearchResult, 'user.real_name', '')
                    return { slackId, count, name: userName, dbId }
                }))

                // This should be broken into batches.
                while (userTagsWithNames.length) {
                    const batch = userTagsWithNames.splice(0, 6)
                    console.log('batch', batch.length)
                    response.blocks.push({
                        "type": "actions",
                        "elements": batch.map((userTagInstance) => {
                            return ({
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": `${userTagInstance.name} • ${userTagInstance.count}`
                                },
                                "style": "primary",
                                "action_id": JSON.stringify(["view-user", userTagInstance.dbId])
                            })
                        })
                    })
                }
            } else {
                response.blocks.push(noTagsSection)
            }
        } else {
            console.log('did not find tag')
            response.blocks.push(noTagsSection)
        }
        return response
    }

    async parseAction(body: ISlackActionResponse) {
        console.log('parseAction', body)

        const team_id = body.team.id
        const team = await this.getTeamBySlackId(team_id)
        const bot_token = team.bot.token
        const team_db_id = await this.getTeamIdBySlackId(team_id)

        const user_id = body.user.id
        const user_db_id = await this.getUserIdBySlackId(user_id, team_db_id)

        if (body.actions) {
            const action = JSON.parse(body.actions[0]?.action_id)

            console.log('action', action)
            const recipient = parseInt(action[2])
            const tagText = (`${action[1]}` || '').toLowerCase().trim()

            switch (action[0]) {
                case 'add':
                    await this.addTagToUsers(team_db_id, user_db_id, [recipient], tagText)
                    break;
                case 'remove':
                    await this.removeTagFromUsers(team_db_id, user_db_id, [recipient], tagText)
                    break;
                case 'add-input':
                    const tags: string[] = body.actions[0].value.trim().toLowerCase().split(',').map(tag => tag.trim()).filter(tag => !!tag)
                    await Promise.all(tags.map(tag => this.addTagToUsers(team_db_id, user_db_id, [recipient], slugify(tag))))
                    break;
                case 'edit-self':
                    this.showEditSelfModal(body, user_db_id)
                    return {}
                case 'view-user':
                    return this.getUserProfileResponse(action[1], user_db_id)
                case 'view-tag':
                    return this.getTagSearchResponse(tagText, team_db_id, bot_token)
            }

            const updatedUser = await this.getUserProfileResponse(recipient, user_db_id)
            return { ...updatedUser, replace_original: true }
        }
    }

    async parseViewSubmission(body: ISlackViewSubmissionBody) {
        // A user is attempting to update their profile.
        const values = get(body, 'view.state.values')
        const team_db_id = await this.getTeamIdBySlackId(body.team.id)
        const user_db_id = await this.getUserIdBySlackId(body.user.id, team_db_id)
        if (values) {
            const valuesToUpdate: Partial<IUser> = {}
            Object.keys(values).forEach(key => {
                const potentialValueToUpdate = values[key]
                Object.keys(potentialValueToUpdate).forEach(value => {
                    if (['linkedInURL', 'githubURL', 'twitterURL'].includes(value)) {
                        const testValue: string | null = potentialValueToUpdate[value].value
                        // TODO - This can accept any URL.  Lock to hostname.
                        if (isValidURL(testValue, ['https'])) {
                            valuesToUpdate[value] = testValue
                        }
                    }
                })
            })

            if (Object.keys(valuesToUpdate).length) {
                await User.update(valuesToUpdate, { where: { id: user_db_id } })
            }
        }

        return {
            "response_action": "clear"
        }
    }

    private async showEditSelfModal(body: ISlackActionResponse, user_db_id: number) {
        console.log('showEditSelfModal')
        const user = await User.findOne({ where: { id: user_db_id }, include: [{ model: Team, as: 'team' }] })
        const team: Team = user.get('team')
        const bot_token = team.get('installation').bot.token

        const payload: any = {
            "trigger_id": body.trigger_id,
            "view": {
                "type": "modal",
                "callback_id": "modal-identifier",
                "title": {
                    "type": "plain_text",
                    "text": "Edit profile"
                },
                "submit": {
                    "type": "plain_text",
                    "text": "Update Profile"
                },
                "blocks": [
                    {
                        "type": "input",
                        "optional": true,
                        "element": {
                            "type": "plain_text_input",
                            "action_id": "linkedInURL",
                            "placeholder": {
                                "type": "plain_text",
                                "text": "https://linkedin.com/in/..."
                            },
                            "initial_value": user.get("linkedInURL") || ""
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "LinkedIn",
                            "emoji": true
                        }
                    },
                    {
                        "type": "input",
                        "optional": true,
                        "element": {
                            "type": "plain_text_input",
                            "action_id": "twitterURL",
                            "placeholder": {
                                "type": "plain_text",
                                "text": "https://twitter.com/..."
                            },
                            "initial_value": user.get("twitterURL") || ""
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Twitter",
                            "emoji": true
                        }
                    },
                    {
                        "type": "input",
                        "optional": true,
                        "element": {
                            "type": "plain_text_input",
                            "action_id": "githubURL",
                            "initial_value": user.get("githubURL") || "",
                            "placeholder": {
                                "type": "plain_text",
                                "text": "https://github.com/..."
                            }
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Github",
                            "emoji": true
                        }
                    }
                ]
            }
        }

        return getWebClient(bot_token).views.open(payload)
    }

    private async getUserTags(user_db_id: number): Promise<{ text: string, taggers: number[] }[]> {
        console.log('getUserTags', user_db_id)
        const tags = (await UserTag.findAll({ where: { taggedId: user_db_id }, include: [{ model: Tag, as: 'tag' }] })).map(tag => tag.get({ plain: true }))

        const tagsByUser = tags.reduce((currentTags, newTag) => {
            const text = get(newTag, 'tag.text')
            const tagger = get(newTag, 'taggerId')
            if (!currentTags[text]) {
                currentTags[text] = []
            }
            currentTags[text].push(tagger)
            return currentTags
        }, {})
        return Object.keys(tagsByUser).map(key => ({ text: key, taggers: tagsByUser[key] })).sort((a, b) => b.taggers.length - a.taggers.length)
    }

    private stem(tag: string = ''): string {
        return PorterStemmer.stem(tag)
    }

    private async getTeamBySlackId(slackId: string): Promise<Installation> {
        const team = await Team.findOne({ where: { slackId: slackId } })
        if (team) {
            return team.get('installation')
        }
        return null
    }

    private async getTeamIdBySlackId(slackId: string): Promise<number> {
        return (await Team.findOne({ where: { slackId: slackId } })).get('id')
    }

    private async getUserIdBySlackId(slackId: string, teamId: number): Promise<number> {
        console.log('getUserIdBySlackId', slackId, teamId)
        const user = await User.findOne({ where: { slackId } })
        if (user) {
            console.log('Found user', slackId)
            return user.get('id')
        }
        console.log('Creating user', slackId, teamId)
        return User.create({ slackId, teamId }).then(user => user.get('id'))
    }

    private async getUserIdsBySlackIds(slackIds: string[], teamId: number): Promise<number[]> {
        return await Promise.all(slackIds.map(async slackId => User.findOrCreate({ where: { slackId, teamId } }).then(rsp => rsp[0].get('id'))))
    }

    async addTagToUsers(teamId: number, taggerId: number, taggedUsers: number[], tagText: string): Promise<void> {
        console.log('addTagToUsers', teamId, taggerId, taggedUsers, tagText)
        if (!tagText.trim().length) {
            return
        }

        const [tag] = await Tag.findOrCreate({ where: { text: tagText } })

        // Add lemma to tag for searching.
        const stem: string = this.stem(tagText)
        try {
            await Lemma.create({ text: stem, tagId: tag.get('id') })
        } catch (e) {
            console.error('Error whilst creating a lemma.')
        }

        // This should be possible with a single query.
        await Promise.all(taggedUsers.map(taggedId => UserTag.findOrCreate({ where: { taggedId, taggerId, tagId: tag.get('id'), teamId } })))

        // Need to figure out how to properly query like this.  At present, taggedId doesn't get set.
        // await UserTag.findOrCreate({ where: { [Op.or]: taggedUsers.map(taggedId => ({ taggedId })), tagId: tag.get('id'), teamId, taggerId } })
    }
    async removeTagFromUsers(teamId: number, taggerId: number, taggedUsers: number[], tagText: string): Promise<void> {
        console.log('removeTagFromUsers', teamId, taggerId, taggedUsers, tagText)
        if (!tagText.trim().length) {
            return
        }

        const tag = await Tag.findOne({ where: { text: tagText } })
        if (tag) {
            await UserTag.destroy({ where: { [Op.or]: taggedUsers.map(taggedId => ({ taggedId })), tagId: tag.get('id'), teamId, taggerId } })
        }
    }
    async getUserProfileResponse(userId: number, requestingUserId: number) {
        const user = await User.findByPk(userId, { include: [{ model: Team, as: 'team' }] })
        // console.log('user', user)
        const team = user.get('team')
        const bot_token = team.get('installation').bot.token
        const userSearchResult = await getWebClient(bot_token).users.info({ user: user.get('slackId') })
        console.log('slack user', userSearchResult)
        const name = get(userSearchResult, 'user.real_name', '')
        const tagsByUserArr = await this.getUserTags(userId)
        const userRequestingSelf: boolean = userId === requestingUserId

        let title: string = get(userSearchResult, 'user.profile.title', '') ? `*${name}*  _${get(userSearchResult, 'user.profile.title', '')}_` : `*${name}*`
        const email: string = get(userSearchResult, 'user.profile.email', '') as string

        if (email) {
            title += `\n${email}`
        }

        if (userRequestingSelf) {
            title += "\n_(this is you!)_"
        }


        const urls = ['linkedInURL', 'twitterURL', 'githubURL']
        urls.forEach(url => {
            if (user.get(url)) {
                title += `\n${user.get(url)}`
            }
        })

        const response: { blocks: any } = {
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": title
                    }
                },
                {
                    "type": "divider"
                }
            ]
        }

        if (userRequestingSelf) {
            response.blocks.push({
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "edit"
                        },
                        "style": "primary",
                        "action_id": JSON.stringify(["edit-self"])
                    }
                ]
            })
        }

        const image = get(userSearchResult, 'user.profile.image_72', '')
        if (image) {
            response.blocks[0].accessory = {
                "type": "image",
                "image_url": image,
                "alt_text": `${name}'s profile picture`
            }
        }
        response.blocks.push(
            {
                "dispatch_action": true,
                "type": "input",
                "element": {
                    "type": "plain_text_input",
                    "action_id": JSON.stringify(['add-input', '', userId]),
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Add a tag, separated by commas"
                    }
                },
                "label": {
                    "type": "plain_text",
                    "text": "Tags"
                }
            }
        )

        if (tagsByUserArr.length) {
            response.blocks.push(
                {
                    "type": "actions",
                    "elements": tagsByUserArr.map(tag => {
                        const hasTagged: boolean = tag.taggers.includes(requestingUserId)
                        return {
                            type: "button",
                            text: {
                                type: "plain_text",
                                text: `${hasTagged ? '⬇️' : '⬆️'} ${tag.text} • ${tag.taggers.length}`
                            },
                            style: hasTagged ? 'danger' : 'primary',
                            action_id: JSON.stringify([hasTagged ? 'remove' : 'add', tag.text, userId])
                        }
                    })
                })
        }

        return response
    }
}

export default Whodini