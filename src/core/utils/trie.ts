export type TrieNode = { [key: string]: TrieNode };

export default class TrieWithPrefix<TValue> {
  constructor(
    private readonly _splitKey = (key: string) => key.split('/'),
    private readonly _joinKey = (fragments: string[]) => fragments.join('/')
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

  delete(key: string) {
    const fragments = this._splitKey(key);
    let node: TrieNode | undefined = this._root;
    for (const next of fragments) {
      const nextNode: TrieNode | undefined = node![next];
      if (!nextNode) {
        break;
      } else {
        node = nextNode;
      }
    }
    if (node) {
      this._valueMap.delete(node);
    }
  }



  list(prefix: string = ""){
    const fragments = this._splitKey(prefix);
    let node: TrieNode | undefined = this._root;
    for (const next of fragments) {
      const nextNode: TrieNode | undefined = node![next];
      if (!nextNode) {
        return [];
      } else {
        node = nextNode;
      }
    }
    const result: string[] = [];
    const stack: [string, TrieNode][] = [[prefix, node]];
    while (stack.length > 0) {
      const [currentAddress, currentNode] = stack.shift()!;
      if (this._valueMap.has(currentNode)) {
        result.push(currentAddress);
      }
      for (const key in currentNode) {
        const nextNode = currentNode[key]!;
        const nextAddress = this._joinKey([currentAddress, key]);
        stack.push([nextAddress, nextNode]);
      }
    }
    return result
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
