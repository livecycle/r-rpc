export type TrieNode = { [key: string]: TrieNode };

export default class TrieWithPrefix<TValue> {
  constructor(
    private readonly _splitKey = (key: string) => key.split('/'),
    _joinKey = (fragments: []) => fragments.join('/')
  ) {}

  private readonly _root: TrieNode = {};
  private readonly _valueMap = new WeakMap<TrieNode, { wildcard: boolean; value: TValue }>();
  set(key: string, value: TValue, wildcard = false) {
    const fragments = this._splitKey(key);
    let node = this._root;
    for (const next of fragments) {
      const nextNode = node[next];
      if (!nextNode) {
        node[next] = {};
      }
      node = node[next]!;
    }
    this._valueMap.set(node, { value, wildcard });
  }

  get(key: string): TValue | undefined {
    const fragments = this._splitKey(key);
    let node: TrieNode | undefined = this._root;
    let closestWildCardNode: TrieNode | undefined = undefined;
    for (const next of fragments) {
      const nextNode: TrieNode | undefined = node![next];
      if (!nextNode) {
        node = closestWildCardNode;
        break;
      } else {
        node = nextNode;
        if (this._valueMap.get(node)?.wildcard) {
          closestWildCardNode = node;
        }
      }
    }
    node = node ?? closestWildCardNode;
    return node && this._valueMap.get(node)?.value;
  }
}
