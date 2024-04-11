export type TrieNode = {
    [key: string]: TrieNode;
};
export default class TrieWithPrefix<TValue> {
    private readonly _splitKey;
    private readonly _joinKey;
    constructor(_splitKey?: (key: string) => string[], _joinKey?: (fragments: string[]) => string);
    private readonly _root;
    private readonly _valueMap;
    set(key: string, value: TValue, wildcard?: boolean): void;
    delete(key: string): void;
    list(prefix?: string): string[];
    get(key: string): TValue | undefined;
}
//# sourceMappingURL=trie.d.ts.map