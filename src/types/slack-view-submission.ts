export interface ISlackViewSubmissionBody {
    type: string;
    team: Team;
    user: User;
    api_app_id: string;
    token: string;
    trigger_id: string;
    view: View;
    response_urls: any[];
    is_enterprise_install: boolean;
    enterprise: null;
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

export interface View {
    id: string;
    team_id: string;
    type: string;
    blocks: Block[];
    private_metadata: string;
    callback_id: string;
    state: State;
    hash: string;
    title: Submit;
    clear_on_close: boolean;
    notify_on_close: boolean;
    close: null;
    submit: Submit;
    previous_view_id: null;
    root_view_id: string;
    app_id: string;
    external_id: string;
    app_installed_team_id: string;
    bot_id: string;
}

export interface Block {
    type: string;
    block_id: string;
    label: Submit;
    optional: boolean;
    dispatch_action: boolean;
    element: Element;
}

export interface Element {
    type: string;
    action_id: string;
    placeholder: Submit;
    dispatch_action_config: DispatchActionConfig;
}

export interface DispatchActionConfig {
    trigger_actions_on: string[];
}

export interface Submit {
    type: string;
    text: string;
    emoji: boolean;
}

export interface State {
    values: any;
}