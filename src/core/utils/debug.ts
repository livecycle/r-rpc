import { routerTrieSymbol } from "../contracts.js"
import { RpcRouter } from "../router.js"
import Trie from "./trie.js"

export const getTrie = (router: RpcRouter) => {
    if (routerTrieSymbol in router) {
        return router[routerTrieSymbol] as Trie<any>
    }
}

export const listRoutes = (router: RpcRouter, address: string) => {
    return getTrie(router)?.list(address) ?? []
}