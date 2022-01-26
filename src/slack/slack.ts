import { WebClient } from "@slack/web-api";

export default (token: string) => new WebClient(token);
