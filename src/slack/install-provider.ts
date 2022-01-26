import { InstallProvider } from '@slack/oauth'
import Team from '../models/team'

const { SLACK_CLIENT_ID, SLACK_CLIENT_SECRET } = process.env

export default () => new InstallProvider({
    clientId: SLACK_CLIENT_ID,
    clientSecret: SLACK_CLIENT_SECRET,
    stateSecret: 'tooty-fruity',
    installationStore: {
        storeInstallation: async (installation) => {
            console.log('Receiving a new installation', installation)
            if (installation.isEnterpriseInstall) {
                await Team.create({ slackId: installation.enterprise.id, installation: installation })
                return
            }
            await Team.create({ slackId: installation.team.id, installation: installation })
        },
        fetchInstallation: async (installQuery) => {
            console.log('Fetching installation')
            if (installQuery.isEnterpriseInstall) {
                return (await Team.findOne({ where: { slackId: installQuery.enterpriseId } })).get('installation')
            }
            if (installQuery.teamId !== undefined) {
                return (await Team.findOne({ where: { slackId: installQuery.teamId } })).get('installation')
            }
            throw new Error('Failed fetching installation');

        },
        deleteInstallation: async (installQuery) => {
            if (installQuery.isEnterpriseInstall) {
                Team.destroy({ where: { slackId: installQuery.enterpriseId } })
                return
            }
            if (installQuery.teamId !== undefined) {
                Team.destroy({ where: { slackId: installQuery.teamId } })
                return
            }
            throw new Error('Failed deleting installation');
        }
    }
});