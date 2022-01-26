export interface ISlackCommandBody {
    token: string
    team_id: string
    team_domain: string
    channel_id: string
    channel_name: string
    user_id: string
    user_name: string
    command: string
    text: string
    response_url: string
    api_app_id: string
    is_enterprise_install: 'true' | 'false'
    trigger_id: string
}