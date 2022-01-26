import { URL } from 'url';

export const isValidURL = (s: string, protocols: string[]): boolean => {
    try {
        const url = new URL(s);
        return protocols
            ? url.protocol
                ? protocols.map(x => `${x.toLowerCase()}:`).includes(url.protocol)
                : false
            : true;
    } catch (err) {
        return false;
    }
};