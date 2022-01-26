export interface ISlackActionResponse {
    type: string;
    user: User;
    api_app_id: string;
    token: string;
    container: Container;
    trigger_id: string;
    team: Team;
    enterprise: null;
    is_enterprise_install: boolean;
    channel: Channel;
    state: State;
    response_url: string;
    actions: Action[];
}

export interface Action {
    action_id: string;
    block_id: string;
    text: Text;
    style: string;
    type: string;
    action_ts: string;
    value?: string;
}

export interface Text {
    type: string;
    text: string;
    emoji: boolean;
}

export interface Channel {
    id: string;
    name: string;
}

export interface Container {
    type: string;
    message_ts: string;
    channel_id: string;
    is_ephemeral: boolean;
}

export interface State {
    values: Values;
}

export interface Values {
}

export interface Team {
    id: string;
    domain: string;
}

export interface User {
    id: string;
    username: string;
    name: string;
    team_id: string;
}