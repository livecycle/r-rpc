export type TrieNode = {
    [key: string]: TrieNode;
};
export default class TrieWithPrefix<TValue> {
    private readonly _splitKey;
    constructor(_splitKey?: (key: string) => string[], _joinKey?: (fragments: []) => string);
    private readonly _root;
    private readonly _valueMap;
    set(key: string, value: TValue, wildcard?: boolean): void;
    get(key: string): TValue | undefined;
}
//# sourceMappingURL=trie.d.ts.map