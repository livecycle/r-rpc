import { routerTrieSymbol } from "../contracts.js";
export const getTrie = (router) => {
    if (routerTrieSymbol in router) {
        return router[routerTrieSymbol];
    }
};
export const listRoutes = (router, address) => {
    return getTrie(router)?.list(address) ?? [];
};
