import { flatten } from 'lodash'
export const getRegExMatches = (regex: RegExp, tokens: string[]): string[] => {
    const matches = [];
    let match: RegExpExecArray | null;
    tokens.forEach(token => {
        if ((match = regex.exec(token)) !== null) {
            matches.push(match.splice(1));
        }
    })
    return flatten(matches)
}